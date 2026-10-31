package com.tripzee.destination;

import com.tripzee.auth.CurrentUser;
import com.tripzee.common.ApiException;
import com.tripzee.common.Geo;
import com.tripzee.common.PageResponse;
import com.tripzee.destination.DestinationDtos.CategoryDto;
import com.tripzee.destination.DestinationDtos.DestinationCard;
import com.tripzee.destination.DestinationDtos.DestinationDetail;
import com.tripzee.destination.DestinationDtos.RatingStats;
import com.tripzee.destination.DestinationDtos.SourceDto;
import com.tripzee.domain.Destination;
import com.tripzee.domain.SavedPlace;
import com.tripzee.repo.CategoryRepository;
import com.tripzee.repo.DestinationRepository;
import com.tripzee.repo.ReviewRepository;
import com.tripzee.repo.SavedPlaceRepository;
import com.tripzee.repo.SourceReferenceRepository;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DestinationService {
    private final DestinationRepository destinations;
    private final CategoryRepository categories;
    private final ReviewRepository reviews;
    private final SourceReferenceRepository sources;
    private final SavedPlaceRepository saved;

    public record SearchQuery(String q, String city, String category, String interest, String sort, int page, int pageSize) {}

    public record CityDto(String name, long count, double lat, double lng) {}

    public Map<String, RatingStats> ratings(Collection<String> ids) {
        Map<String, RatingStats> out = new HashMap<>();
        if (ids.isEmpty()) return out;
        for (Object[] row : reviews.ratingStats(ids)) {
            out.put((String) row[0], new RatingStats(Math.round(((Number) row[1]).doubleValue() * 10) / 10.0, ((Number) row[2]).longValue()));
        }
        return out;
    }

    // ponytail: filtering in memory — fine for a catalogue of a few hundred places.
    // Move to DB-side full-text search (Postgres tsvector) when the catalogue grows past ~5k rows.
    public PageResponse<DestinationCard> search(SearchQuery sq) {
        String q = sq.q() == null ? null : sq.q().trim().toLowerCase(Locale.ROOT);
        Stream<Destination> s = destinations.findByPublishedTrue().stream();
        if (q != null && !q.isEmpty()) {
            s = s.filter(d -> contains(d.getName(), q) || contains(d.getCity(), q) || contains(d.getNameHi(), q)
                    || contains(d.getSummary(), q) || contains(d.getCategory().getName(), q));
        }
        if (sq.city() != null && !sq.city().isBlank()) s = s.filter(d -> d.getCity().equalsIgnoreCase(sq.city()));
        if (sq.category() != null && !sq.category().isBlank()) s = s.filter(d -> d.getCategory().getSlug().equals(sq.category()));
        if (sq.interest() != null && !sq.interest().isBlank()) s = s.filter(d -> d.interestList().contains(sq.interest()));
        List<Destination> all = s.toList();
        Map<String, RatingStats> r = ratings(all.stream().map(Destination::getId).toList());
        Comparator<Destination> order = "rating".equals(sq.sort())
                ? Comparator.<Destination>comparingDouble(d -> r.getOrDefault(d.getId(), RatingStats.NONE).average() == null ? -1
                        : r.get(d.getId()).average()).reversed().thenComparing(Destination::getName)
                : Comparator.comparing(Destination::getCity).thenComparing(Destination::getName);
        List<DestinationCard> cards = all.stream().sorted(order)
                .map(d -> DestinationCard.of(d, r.getOrDefault(d.getId(), RatingStats.NONE), null)).toList();
        int size = Math.max(1, Math.min(sq.pageSize(), 60));
        int page = Math.max(1, sq.page());
        int from = Math.min((page - 1) * size, cards.size());
        int to = Math.min(from + size, cards.size());
        return new PageResponse<>(cards.subList(from, to), page, size, cards.size(), (int) Math.ceil(cards.size() / (double) size));
    }

    private static boolean contains(String haystack, String needle) {
        return haystack != null && haystack.toLowerCase(Locale.ROOT).contains(needle);
    }

    public List<CityDto> cities() {
        return destinations.cities().stream()
                .map(r -> new CityDto((String) r[0], ((Number) r[1]).longValue(), ((Number) r[2]).doubleValue(), ((Number) r[3]).doubleValue()))
                .toList();
    }

    public List<CategoryDto> categories() {
        return categories.findAll().stream().map(CategoryDto::of).toList();
    }

    public List<DestinationCard> near(double lat, double lng, double radiusKm, String excludeId) {
        double dLat = radiusKm / 111;
        double dLng = radiusKm / (111 * Math.cos(Math.toRadians(lat)));
        List<Destination> rows = destinations.findByLatBetweenAndLngBetweenAndPublishedTrue(lat - dLat, lat + dLat, lng - dLng, lng + dLng)
                .stream().filter(d -> !d.getId().equals(excludeId)).toList();
        Map<String, RatingStats> r = ratings(rows.stream().map(Destination::getId).toList());
        return rows.stream()
                .map(d -> DestinationCard.of(d, r.getOrDefault(d.getId(), RatingStats.NONE), Geo.round1(Geo.haversineKm(lat, lng, d.getLat(), d.getLng()))))
                .filter(c -> c.distanceKm() <= radiusKm)
                .sorted(Comparator.comparingDouble(DestinationCard::distanceKm))
                .toList();
    }

    public Destination requireBySlug(String slug, boolean includeUnpublished) {
        Destination d = destinations.findBySlug(slug).orElseThrow(() -> ApiException.notFound("Destination"));
        if (!d.isPublished() && !includeUnpublished) throw ApiException.notFound("Destination");
        return d;
    }

    public DestinationDetail detail(String slug) {
        boolean admin = CurrentUser.get().map(u -> u.isAdmin()).orElse(false);
        Destination d = requireBySlug(slug, admin);
        RatingStats rating = ratings(List.of(d.getId())).getOrDefault(d.getId(), RatingStats.NONE);
        Map<Integer, Long> histogram = new TreeMap<>();
        for (int i = 1; i <= 5; i++) histogram.put(i, 0L);
        for (Object[] row : reviews.histogram(d.getId())) histogram.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        String userId = CurrentUser.id().orElse(null);
        SavedPlace sp = userId == null ? null : saved.findByUserIdAndDestinationId(userId, d.getId()).orElse(null);
        boolean reviewed = userId != null && reviews.existsByUserIdAndDestinationId(userId, d.getId());
        List<SourceDto> src = sources.findByDestinationIdOrderByCreatedAt(d.getId()).stream().map(SourceDto::of).toList();
        List<DestinationCard> nearby = near(d.getLat(), d.getLng(), 60, d.getId()).stream().limit(8).toList();
        return new DestinationDetail(d.getId(), d.getSlug(), d.getName(), d.getNameHi(), d.getCity(), d.getState(), d.getCountry(),
                CategoryDto.of(d.getCategory()), d.getLat(), d.getLng(), d.getCoordsSource(), d.getSummary(), d.getSummaryHi(),
                d.getDescription(), d.getHistory(), d.getCulturalSignificance(), d.interestList(), d.getOpeningHours(),
                d.getEntryFee(), d.getVisitMinutes(), d.getBestTimeToVisit(), d.getAccessibility(), d.getGuidelines(),
                d.getOfficialUrl(), d.getTicketUrl(), d.isFactsVerified(), d.getLastVerifiedAt(), d.getImageUrl(),
                d.getImageCredit(), d.isPublished(), src, rating, histogram, nearby, sp != null, sp == null ? null : sp.getId(), reviewed);
    }
}
