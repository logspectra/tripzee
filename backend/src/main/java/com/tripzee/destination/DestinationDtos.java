package com.tripzee.destination;

import com.tripzee.domain.Category;
import com.tripzee.domain.Destination;
import com.tripzee.domain.SourceReference;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class DestinationDtos {
    private DestinationDtos() {}

    public record CategoryDto(String slug, String name, String nameHi) {
        static CategoryDto of(Category c) {
            return new CategoryDto(c.getSlug(), c.getName(), c.getNameHi());
        }
    }

    public record RatingStats(Double average, long count) {
        public static final RatingStats NONE = new RatingStats(null, 0);
    }

    public record DestinationCard(String id, String slug, String name, String nameHi, String city, String state,
                                  CategoryDto category, double lat, double lng, String summary, String summaryHi,
                                  String imageUrl, String imageCredit, List<String> interests, Double avgRating,
                                  long reviewCount, boolean factsVerified, Double distanceKm) {
        public static DestinationCard of(Destination d, RatingStats r, Double distanceKm) {
            return new DestinationCard(d.getId(), d.getSlug(), d.getName(), d.getNameHi(), d.getCity(), d.getState(),
                    CategoryDto.of(d.getCategory()), d.getLat(), d.getLng(), d.getSummary(), d.getSummaryHi(),
                    d.getImageUrl(), d.getImageCredit(), d.interestList(), r.average(), r.count(), d.isFactsVerified(), distanceKm);
        }
    }

    public record SourceDto(String id, String label, String url, String field) {
        public static SourceDto of(SourceReference s) {
            return new SourceDto(s.getId(), s.getLabel(), s.getUrl(), s.getField());
        }
    }

    public record DestinationDetail(String id, String slug, String name, String nameHi, String city, String state,
                                    String country, CategoryDto category, double lat, double lng, String coordsSource,
                                    String summary, String summaryHi, String description, String history,
                                    String culturalSignificance, List<String> interests, String openingHours,
                                    String entryFee, int visitMinutes, String bestTimeToVisit, String accessibility,
                                    String guidelines, String officialUrl, String ticketUrl, boolean factsVerified,
                                    Instant lastVerifiedAt, String imageUrl, String imageCredit, boolean published,
                                    List<SourceDto> sources, RatingStats rating, Map<Integer, Long> ratingHistogram,
                                    List<DestinationCard> nearby, boolean saved, String savedId, boolean reviewedByMe) {}
}
