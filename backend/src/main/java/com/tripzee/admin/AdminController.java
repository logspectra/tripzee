package com.tripzee.admin;

import com.tripzee.auth.AppUser;
import com.tripzee.auth.CurrentUser;
import com.tripzee.common.ApiException;
import com.tripzee.common.PageResponse;
import com.tripzee.destination.DestinationDtos.SourceDto;
import com.tripzee.domain.Category;
import com.tripzee.domain.Destination;
import com.tripzee.domain.Report;
import com.tripzee.domain.Review;
import com.tripzee.domain.SourceReference;
import com.tripzee.domain.User;
import com.tripzee.me.NotificationService;
import com.tripzee.places.WikiService;
import com.tripzee.repo.CategoryRepository;
import com.tripzee.repo.DestinationRepository;
import com.tripzee.repo.ReportRepository;
import com.tripzee.repo.ReviewRepository;
import com.tripzee.repo.RoomMessageRepository;
import com.tripzee.repo.SourceReferenceRepository;
import com.tripzee.repo.TravelRoomRepository;
import com.tripzee.repo.TripRepository;
import com.tripzee.repo.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Admin-only API. Access is enforced by SecurityConfig (/api/admin/** requires ROLE_ADMIN). */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private static final String URL = "^https?://[^\\s]{3,490}$";

    private final UserRepository users;
    private final DestinationRepository destinations;
    private final CategoryRepository categories;
    private final SourceReferenceRepository sources;
    private final ReviewRepository reviews;
    private final ReportRepository reports;
    private final RoomMessageRepository messages;
    private final TripRepository trips;
    private final TravelRoomRepository rooms;
    private final WikiService wiki;
    private final NotificationService notifications;

    // ---------- stats ----------

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        Instant week = Instant.now().minus(Duration.ofDays(7));
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("users", users.count());
        s.put("newUsers7d", users.countByCreatedAtAfter(week));
        s.put("destinations", destinations.count());
        s.put("publishedDestinations", destinations.countByPublishedTrue());
        s.put("verifiedDestinations", destinations.countByFactsVerifiedTrue());
        s.put("trips", trips.count());
        s.put("newTrips7d", trips.countByCreatedAtAfter(week));
        s.put("reviews", reviews.countByStatus(Review.VISIBLE));
        s.put("hiddenReviews", reviews.countByStatus(Review.HIDDEN));
        s.put("openReports", reports.countByStatus(Report.OPEN));
        s.put("rooms", rooms.count());
        return s;
    }

    // ---------- users ----------

    public record UserRow(String id, String email, String name, String role, String status, Instant createdAt) {}

    public record UserUpdate(@Pattern(regexp = "USER|ADMIN") String role, @Pattern(regexp = "ACTIVE|SUSPENDED") String status) {}

    @GetMapping("/users")
    public PageResponse<UserRow> users(@RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "1") int page) {
        var p = users.findByEmailContainingIgnoreCaseOrNameContainingIgnoreCase(q, q,
                PageRequest.of(Math.max(0, page - 1), 20, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(p, AdminController::row);
    }

    @PatchMapping("/users/{id}")
    @Transactional
    public UserRow updateUser(@PathVariable String id, @Valid @RequestBody UserUpdate body) {
        AppUser me = CurrentUser.require();
        if (id.equals(me.id())) throw ApiException.badRequest("You can't change your own role or status");
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
        if (body.role() != null) u.setRole(body.role());
        if (body.status() != null) u.setStatus(body.status());
        users.save(u);
        return row(u);
    }

    private static UserRow row(User u) {
        return new UserRow(u.getId(), u.getEmail(), u.getName(), u.getRole(), u.getStatus(), u.getCreatedAt());
    }

    // ---------- destinations ----------

    public record AdminDestinationRow(String id, String slug, String name, String city, String category, boolean published,
                                      boolean factsVerified, Instant lastVerifiedAt, boolean hasImage, Instant updatedAt) {}

    public record DestinationForm(
            @NotBlank @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$") @Size(max = 120) String slug,
            @NotBlank @Size(max = 160) String name,
            @Size(max = 160) String nameHi,
            @NotBlank @Size(max = 80) String city,
            @Size(max = 80) String state,
            @NotBlank @Size(max = 40) String categorySlug,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
            @NotBlank @Size(max = 1000) String summary,
            @Size(max = 1000) String summaryHi,
            @NotBlank @Size(max = 8000) String description,
            @Size(max = 8000) String history,
            @Size(max = 8000) String culturalSignificance,
            @Size(max = 300) @Pattern(regexp = "^[a-z,]*$") String interests,
            @Size(max = 500) String openingHours,
            @Size(max = 500) String entryFee,
            @Min(15) @Max(720) Integer visitMinutes,
            @Size(max = 500) String bestTimeToVisit,
            @Size(max = 1000) String accessibility,
            @Size(max = 2000) String guidelines,
            @Pattern(regexp = URL) String officialUrl,
            @Pattern(regexp = URL) String ticketUrl,
            @Size(max = 200) String wikiTitle,
            @Pattern(regexp = URL) String imageUrl,
            @Size(max = 300) String imageCredit,
            Boolean published) {}

    public record SourceForm(@NotBlank @Size(max = 200) String label, @NotBlank @Pattern(regexp = URL) String url,
                             @Size(max = 60) String field) {}

    public record VerifyForm(@NotNull Boolean verified) {}

    @GetMapping("/destinations")
    @Transactional(readOnly = true)
    public List<AdminDestinationRow> destinations() {
        return destinations.findAllForAdmin().stream().map(d -> new AdminDestinationRow(d.getId(), d.getSlug(), d.getName(), d.getCity(),
                d.getCategory().getName(), d.isPublished(), d.isFactsVerified(), d.getLastVerifiedAt(), d.getImageUrl() != null, d.getUpdatedAt())).toList();
    }

    @GetMapping("/destinations/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> destination(@PathVariable String id) {
        Destination d = destinations.findById(id).orElseThrow(() -> ApiException.notFound("Destination"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.getId());
        out.put("form", form(d));
        out.put("factsVerified", d.isFactsVerified());
        out.put("lastVerifiedAt", d.getLastVerifiedAt());
        out.put("coordsSource", d.getCoordsSource());
        out.put("sources", sources.findByDestinationIdOrderByCreatedAt(d.getId()).stream().map(SourceDto::of).toList());
        return out;
    }

    @PostMapping("/destinations")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> createDestination(@Valid @RequestBody DestinationForm f) {
        if (destinations.findBySlug(f.slug()).isPresent()) throw ApiException.conflict("Slug already in use");
        Destination d = new Destination();
        apply(d, f);
        destinations.save(d);
        return Map.of("id", d.getId(), "slug", d.getSlug());
    }

    @PatchMapping("/destinations/{id}")
    @Transactional
    public Map<String, Object> updateDestination(@PathVariable String id, @Valid @RequestBody DestinationForm f) {
        Destination d = destinations.findById(id).orElseThrow(() -> ApiException.notFound("Destination"));
        destinations.findBySlug(f.slug()).filter(x -> !x.getId().equals(id)).ifPresent(x -> {
            throw ApiException.conflict("Slug already in use");
        });
        boolean factsChanged = !eq(d.getOpeningHours(), f.openingHours()) || !eq(d.getEntryFee(), f.entryFee())
                || !eq(d.getOfficialUrl(), f.officialUrl()) || !eq(d.getTicketUrl(), f.ticketUrl());
        if (factsChanged) d.setFactsVerified(false); // edited facts must be re-verified
        if (d.getLat() != f.lat() || d.getLng() != f.lng()) d.setCoordsSource("Admin");
        apply(d, f);
        destinations.save(d);
        return Map.of("id", d.getId(), "slug", d.getSlug(), "factsVerified", d.isFactsVerified());
    }

    @PostMapping("/destinations/{id}/verify")
    @Transactional
    public Map<String, Object> verify(@PathVariable String id, @Valid @RequestBody VerifyForm body) {
        Destination d = destinations.findById(id).orElseThrow(() -> ApiException.notFound("Destination"));
        if (body.verified() && sources.findByDestinationIdOrderByCreatedAt(id).isEmpty()) {
            throw ApiException.badRequest("Add at least one source link before marking facts as verified");
        }
        d.setFactsVerified(body.verified());
        d.setLastVerifiedAt(body.verified() ? Instant.now() : d.getLastVerifiedAt());
        destinations.save(d);
        return Map.of("factsVerified", d.isFactsVerified());
    }

    @PostMapping("/destinations/{id}/sources")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SourceDto addSource(@PathVariable String id, @Valid @RequestBody SourceForm f) {
        Destination d = destinations.findById(id).orElseThrow(() -> ApiException.notFound("Destination"));
        SourceReference s = new SourceReference();
        s.setDestination(d);
        s.setLabel(f.label().trim());
        s.setUrl(f.url().trim());
        s.setField(f.field() == null || f.field().isBlank() ? "general" : f.field());
        sources.save(s);
        return SourceDto.of(s);
    }

    @DeleteMapping("/destinations/{id}/sources/{sourceId}")
    @Transactional
    public Map<String, Object> deleteSource(@PathVariable String id, @PathVariable String sourceId) {
        SourceReference s = sources.findById(sourceId).filter(x -> x.getDestination().getId().equals(id))
                .orElseThrow(() -> ApiException.notFound("Source"));
        sources.delete(s);
        return Map.of("ok", true);
    }

    @PostMapping("/destinations/{id}/enrich")
    public Map<String, Object> enrich(@PathVariable String id) {
        return Map.of("updated", wiki.enrich(id));
    }

    private void apply(Destination d, DestinationForm f) {
        Category c = categories.findBySlug(f.categorySlug()).orElseThrow(() -> ApiException.badRequest("Unknown category"));
        d.setSlug(f.slug());
        d.setName(f.name().trim());
        d.setNameHi(blank(f.nameHi()));
        d.setCity(f.city().trim());
        d.setState(f.state() == null || f.state().isBlank() ? "Uttar Pradesh" : f.state().trim());
        d.setCategory(c);
        d.setLat(f.lat());
        d.setLng(f.lng());
        d.setSummary(f.summary().trim());
        d.setSummaryHi(blank(f.summaryHi()));
        d.setDescription(f.description().trim());
        d.setHistory(blank(f.history()));
        d.setCulturalSignificance(blank(f.culturalSignificance()));
        d.setInterests(f.interests() == null ? "" : f.interests());
        d.setOpeningHours(blank(f.openingHours()));
        d.setEntryFee(blank(f.entryFee()));
        d.setVisitMinutes(f.visitMinutes() == null ? 120 : f.visitMinutes());
        d.setBestTimeToVisit(blank(f.bestTimeToVisit()));
        d.setAccessibility(blank(f.accessibility()));
        d.setGuidelines(blank(f.guidelines()));
        d.setOfficialUrl(blank(f.officialUrl()));
        d.setTicketUrl(blank(f.ticketUrl()));
        d.setWikiTitle(blank(f.wikiTitle()));
        d.setImageUrl(blank(f.imageUrl()));
        d.setImageCredit(blank(f.imageCredit()));
        d.setPublished(f.published() == null || f.published());
    }

    private static DestinationForm form(Destination d) {
        return new DestinationForm(d.getSlug(), d.getName(), d.getNameHi(), d.getCity(), d.getState(), d.getCategory().getSlug(),
                d.getLat(), d.getLng(), d.getSummary(), d.getSummaryHi(), d.getDescription(), d.getHistory(), d.getCulturalSignificance(),
                d.getInterests(), d.getOpeningHours(), d.getEntryFee(), d.getVisitMinutes(), d.getBestTimeToVisit(), d.getAccessibility(),
                d.getGuidelines(), d.getOfficialUrl(), d.getTicketUrl(), d.getWikiTitle(), d.getImageUrl(), d.getImageCredit(), d.isPublished());
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static boolean eq(String a, String b) {
        return java.util.Objects.equals(blank(a), blank(b));
    }

    // ---------- moderation ----------

    public record ReportRow(String id, String targetType, String targetId, String reason, String details, String status,
                            Instant createdAt, String reporterName, Map<String, Object> target) {}

    public record ReportAction(@NotBlank @Pattern(regexp = "RESOLVED|DISMISSED") String status,
                               @Pattern(regexp = "hide|delete|none") String action) {}

    public record ReviewStatus(@NotBlank @Pattern(regexp = "VISIBLE|HIDDEN") String status) {}

    @GetMapping("/reports")
    @Transactional(readOnly = true)
    public PageResponse<ReportRow> reports(@RequestParam(defaultValue = "OPEN") String status, @RequestParam(defaultValue = "1") int page) {
        var p = reports.findByStatus(status, PageRequest.of(Math.max(0, page - 1), 20, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(p, r -> new ReportRow(r.getId(), r.getTargetType(), r.getTargetId(), r.getReason(), r.getDetails(),
                r.getStatus(), r.getCreatedAt(), users.findById(r.getReporterId()).map(User::getName).orElse("Deleted user"), target(r)));
    }

    private Map<String, Object> target(Report r) {
        Map<String, Object> t = new LinkedHashMap<>();
        if ("review".equals(r.getTargetType())) {
            reviews.findById(r.getTargetId()).ifPresentOrElse(rv -> {
                t.put("title", rv.getTitle());
                t.put("body", rv.getBody());
                t.put("rating", rv.getRating());
                t.put("status", rv.getStatus());
                t.put("author", rv.getUser().getName());
                t.put("destination", rv.getDestination().getName());
                t.put("destinationSlug", rv.getDestination().getSlug());
            }, () -> t.put("deleted", true));
        } else {
            messages.findById(r.getTargetId()).ifPresentOrElse(m -> {
                t.put("body", m.getBody());
                t.put("author", m.getUser().getName());
            }, () -> t.put("deleted", true));
        }
        return t;
    }

    @PatchMapping("/reports/{id}")
    @Transactional
    public Map<String, Object> resolve(@PathVariable String id, @Valid @RequestBody ReportAction body) {
        Report r = reports.findById(id).orElseThrow(() -> ApiException.notFound("Report"));
        String action = body.action() == null ? "none" : body.action();
        if ("review".equals(r.getTargetType())) {
            reviews.findById(r.getTargetId()).ifPresent(rv -> {
                if ("hide".equals(action)) {
                    rv.setStatus(Review.HIDDEN);
                    reviews.save(rv);
                    notifications.notify(rv.getUserId(), "review_hidden", "Your review \"" + rv.getTitle() + "\" was hidden by a moderator.", null);
                } else if ("delete".equals(action)) {
                    reviews.delete(rv);
                }
            });
        } else if (!"none".equals(action)) {
            messages.findById(r.getTargetId()).ifPresent(messages::delete);
        }
        r.setStatus(body.status());
        r.setResolvedById(CurrentUser.require().id());
        reports.save(r);
        notifications.notify(r.getReporterId(), "report_" + body.status().toLowerCase(), "Your report was reviewed by a moderator. Thank you!", null);
        return Map.of("ok", true);
    }

    public record AdminReviewRow(String id, int rating, String title, String body, String status, String author,
                                 String destination, String destinationSlug, Instant createdAt) {}

    @GetMapping("/reviews")
    @Transactional(readOnly = true)
    public PageResponse<AdminReviewRow> reviews(@RequestParam(required = false) String status, @RequestParam(defaultValue = "1") int page) {
        var p = reviews.forAdmin(status == null || status.isBlank() ? null : status,
                PageRequest.of(Math.max(0, page - 1), 20, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(p, r -> new AdminReviewRow(r.getId(), r.getRating(), r.getTitle(), r.getBody(), r.getStatus(),
                r.getUser().getName(), r.getDestination().getName(), r.getDestination().getSlug(), r.getCreatedAt()));
    }

    @PatchMapping("/reviews/{id}")
    @Transactional
    public Map<String, Object> reviewStatus(@PathVariable String id, @Valid @RequestBody ReviewStatus body) {
        Review r = reviews.findById(id).orElseThrow(() -> ApiException.notFound("Review"));
        r.setStatus(body.status());
        reviews.save(r);
        return Map.of("status", r.getStatus());
    }
}
