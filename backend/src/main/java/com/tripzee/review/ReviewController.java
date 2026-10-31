package com.tripzee.review;

import com.tripzee.auth.AppUser;
import com.tripzee.auth.CurrentUser;
import com.tripzee.common.ApiException;
import com.tripzee.common.PageResponse;
import com.tripzee.destination.DestinationService;
import com.tripzee.domain.Destination;
import com.tripzee.domain.Report;
import com.tripzee.domain.Review;
import com.tripzee.repo.ReportRepository;
import com.tripzee.repo.ReviewRepository;
import com.tripzee.repo.RoomMemberRepository;
import com.tripzee.repo.RoomMessageRepository;
import com.tripzee.repo.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
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

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ReviewController {
    private final ReviewRepository reviews;
    private final ReportRepository reports;
    private final RoomMessageRepository messages;
    private final RoomMemberRepository members;
    private final DestinationService destinations;
    private final UserRepository users;

    public record Author(String id, String name) {}

    public record DestinationRef(String slug, String name, String city) {}

    public record ReviewDto(String id, int rating, String title, String body, String tip, LocalDate visitedOn,
                            Instant createdAt, Instant updatedAt, Author author, boolean mine, DestinationRef destination, String status) {}

    public record ReviewRequest(@Min(1) @Max(5) int rating,
                                @NotBlank @Size(min = 3, max = 120) String title,
                                @NotBlank @Size(min = 10, max = 4000, message = "Review must be at least 10 characters") String body,
                                @Size(max = 1000) String tip,
                                @PastOrPresent LocalDate visitedOn) {}

    public record ReportRequest(@NotBlank @Pattern(regexp = "review|message") String targetType,
                                @NotBlank @Size(max = 36) String targetId,
                                @NotBlank @Pattern(regexp = "spam|offensive|misleading|other") String reason,
                                @Size(max = 1000) String details) {}

    static ReviewDto dto(Review r, boolean withDestination) {
        String me = CurrentUser.id().orElse(null);
        Destination d = withDestination ? r.getDestination() : null;
        return new ReviewDto(r.getId(), r.getRating(), r.getTitle(), r.getBody(), r.getTip(), r.getVisitedOn(), r.getCreatedAt(),
                r.getUpdatedAt(), new Author(r.getUserId(), r.getUser().getName()), r.getUserId().equals(me),
                d == null ? null : new DestinationRef(d.getSlug(), d.getName(), d.getCity()), r.getStatus());
    }

    static Sort sort(String sort) {
        return switch (sort == null ? "recent" : sort) {
            case "highest" -> Sort.by(Sort.Order.desc("rating"), Sort.Order.desc("createdAt"));
            case "lowest" -> Sort.by(Sort.Order.asc("rating"), Sort.Order.desc("createdAt"));
            default -> Sort.by(Sort.Order.desc("createdAt"));
        };
    }

    @GetMapping("/destinations/{slug}/reviews")
    @Transactional(readOnly = true)
    public PageResponse<ReviewDto> forDestination(@PathVariable String slug, @RequestParam(defaultValue = "recent") String sort,
                                                  @RequestParam(required = false) Integer rating,
                                                  @RequestParam(defaultValue = "false") boolean tips,
                                                  @RequestParam(defaultValue = "1") int page) {
        Destination d = destinations.requireBySlug(slug, false);
        var p = reviews.forDestination(d.getId(), rating, tips, PageRequest.of(Math.max(0, page - 1), 10, sort(sort)));
        return PageResponse.of(p, r -> dto(r, false));
    }

    @PostMapping("/destinations/{slug}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ReviewDto create(@PathVariable String slug, @Valid @RequestBody ReviewRequest body) {
        AppUser user = CurrentUser.require();
        Destination d = destinations.requireBySlug(slug, false);
        if (reviews.existsByUserIdAndDestinationId(user.id(), d.getId())) {
            throw ApiException.conflict("You've already reviewed this place — edit your existing review instead");
        }
        Review r = new Review();
        r.setUserId(user.id());
        r.setDestinationId(d.getId());
        r.setUser(users.findById(user.id()).orElseThrow());
        apply(r, body);
        reviews.save(r);
        return dto(r, false);
    }

    @PatchMapping("/reviews/{id}")
    @Transactional
    public ReviewDto update(@PathVariable String id, @Valid @RequestBody ReviewRequest body) {
        AppUser user = CurrentUser.require();
        Review r = reviews.findById(id).orElseThrow(() -> ApiException.notFound("Review"));
        if (!r.getUserId().equals(user.id())) throw ApiException.forbidden();
        apply(r, body);
        reviews.save(r);
        return dto(r, false);
    }

    @DeleteMapping("/reviews/{id}")
    @Transactional
    public Map<String, Object> delete(@PathVariable String id) {
        AppUser user = CurrentUser.require();
        Review r = reviews.findById(id).orElseThrow(() -> ApiException.notFound("Review"));
        if (!r.getUserId().equals(user.id()) && !user.isAdmin()) throw ApiException.forbidden();
        reviews.delete(r);
        return Map.of("ok", true);
    }

    @GetMapping("/reviews")
    @Transactional(readOnly = true)
    public PageResponse<ReviewDto> community(@RequestParam(defaultValue = "recent") String sort,
                                             @RequestParam(required = false) Integer minRating,
                                             @RequestParam(defaultValue = "false") boolean tips,
                                             @RequestParam(required = false) String city,
                                             @RequestParam(defaultValue = "1") int page) {
        var p = reviews.community(minRating, tips, city == null || city.isBlank() ? null : city,
                PageRequest.of(Math.max(0, page - 1), 12, sort(sort)));
        return PageResponse.of(p, r -> dto(r, true));
    }

    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> report(@Valid @RequestBody ReportRequest body) {
        AppUser user = CurrentUser.require();
        if ("review".equals(body.targetType())) {
            Review r = reviews.findById(body.targetId()).orElseThrow(() -> ApiException.notFound("Review"));
            if (r.getUserId().equals(user.id())) throw ApiException.badRequest("You can't report your own review");
        } else {
            var m = messages.findById(body.targetId()).orElseThrow(() -> ApiException.notFound("Message"));
            if (!members.existsByRoomIdAndUserId(m.getRoomId(), user.id())) throw ApiException.notFound("Message");
        }
        if (reports.existsByReporterIdAndTargetTypeAndTargetId(user.id(), body.targetType(), body.targetId())) {
            throw ApiException.conflict("You've already reported this. Our moderators will review it.");
        }
        Report rep = new Report();
        rep.setReporterId(user.id());
        rep.setTargetType(body.targetType());
        rep.setTargetId(body.targetId());
        rep.setReason(body.reason());
        rep.setDetails(body.details());
        reports.save(rep);
        return Map.of("ok", true, "message", "Thanks — our moderators will review this report.");
    }

    private static void apply(Review r, ReviewRequest body) {
        r.setRating(body.rating());
        r.setTitle(body.title().trim());
        r.setBody(body.body().trim());
        r.setTip(body.tip() == null || body.tip().isBlank() ? null : body.tip().trim());
        r.setVisitedOn(body.visitedOn());
    }
}
