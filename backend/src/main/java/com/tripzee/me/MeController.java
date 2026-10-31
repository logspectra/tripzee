package com.tripzee.me;

import com.tripzee.auth.AppUser;
import com.tripzee.auth.CurrentUser;
import com.tripzee.common.ApiException;
import com.tripzee.destination.DestinationDtos.DestinationCard;
import com.tripzee.destination.DestinationDtos.RatingStats;
import com.tripzee.destination.DestinationService;
import com.tripzee.domain.Destination;
import com.tripzee.domain.Notification;
import com.tripzee.domain.SavedPlace;
import com.tripzee.repo.DestinationRepository;
import com.tripzee.repo.NotificationRepository;
import com.tripzee.repo.RoomMemberRepository;
import com.tripzee.repo.SavedPlaceRepository;
import com.tripzee.repo.TravelRoomRepository;
import com.tripzee.trip.TripDtos.TripSummary;
import com.tripzee.trip.TripService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MeController {
    private final SavedPlaceRepository saved;
    private final DestinationRepository destinations;
    private final DestinationService destinationService;
    private final NotificationRepository notifications;
    private final RoomMemberRepository members;
    private final TravelRoomRepository rooms;
    private final TripService trips;

    public record SavedDto(String id, String name, String kind, Double lat, Double lng, String externalRef,
                           DestinationCard destination, Instant createdAt) {}

    public record SaveRequest(@Size(max = 36) String destinationId,
                              @Size(max = 120) @Pattern(regexp = "^(node|way|relation)/\\d+$") String externalRef,
                              @Size(max = 200) String name,
                              @Pattern(regexp = "hotel|restaurant|hospital|pharmacy|police|atm|fuel|transport|parking|place") String kind,
                              @DecimalMin("-90") @DecimalMax("90") Double lat,
                              @DecimalMin("-180") @DecimalMax("180") Double lng) {}

    public record NotificationDto(String id, String type, String message, String link, boolean read, Instant createdAt) {}

    public record RoomSummary(String id, String name, long members, boolean owner) {}

    @GetMapping("/saved")
    @Transactional(readOnly = true)
    public List<SavedDto> list() {
        return savedFor(CurrentUser.require());
    }

    private List<SavedDto> savedFor(AppUser user) {
        List<SavedPlace> rows = saved.findByUserIdOrderByCreatedAtDesc(user.id());
        List<String> ids = rows.stream().map(SavedPlace::getDestinationId).filter(x -> x != null).toList();
        Map<String, Destination> dest = destinations.findAllById(ids).stream().collect(Collectors.toMap(Destination::getId, Function.identity()));
        Map<String, RatingStats> ratings = destinationService.ratings(ids);
        return rows.stream().map(s -> {
            Destination d = s.getDestinationId() == null ? null : dest.get(s.getDestinationId());
            return new SavedDto(s.getId(), s.getName(), s.getKind(), s.getLat(), s.getLng(), s.getExternalRef(),
                    d == null ? null : DestinationCard.of(d, ratings.getOrDefault(d.getId(), RatingStats.NONE), null), s.getCreatedAt());
        }).toList();
    }

    @PostMapping("/saved")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> save(@Valid @RequestBody SaveRequest body) {
        AppUser user = CurrentUser.require();
        SavedPlace s = new SavedPlace();
        s.setUserId(user.id());
        if (body.destinationId() != null) {
            Destination d = destinations.findById(body.destinationId()).filter(Destination::isPublished)
                    .orElseThrow(() -> ApiException.notFound("Destination"));
            var existing = saved.findByUserIdAndDestinationId(user.id(), d.getId());
            if (existing.isPresent()) return Map.of("id", existing.get().getId());
            s.setDestinationId(d.getId());
            s.setName(d.getName());
            s.setKind("place");
            s.setLat(d.getLat());
            s.setLng(d.getLng());
        } else {
            if (body.externalRef() == null || body.name() == null || body.name().isBlank() || body.lat() == null || body.lng() == null) {
                throw ApiException.badRequest("externalRef, name, lat and lng are required for map places");
            }
            var existing = saved.findByUserIdAndExternalRef(user.id(), body.externalRef());
            if (existing.isPresent()) return Map.of("id", existing.get().getId());
            s.setExternalRef(body.externalRef());
            s.setName(body.name().trim());
            s.setKind(body.kind() == null ? "place" : body.kind());
            s.setLat(body.lat());
            s.setLng(body.lng());
        }
        if (saved.countByUserId(user.id()) >= 500) throw ApiException.badRequest("You can save up to 500 places");
        saved.save(s);
        return Map.of("id", s.getId());
    }

    @DeleteMapping("/saved/{id}")
    @Transactional
    public Map<String, Object> unsave(@PathVariable String id) {
        AppUser user = CurrentUser.require();
        SavedPlace s = saved.findById(id).filter(x -> x.getUserId().equals(user.id()))
                .orElseThrow(() -> ApiException.notFound("Saved place"));
        saved.delete(s);
        return Map.of("ok", true);
    }

    @GetMapping("/me/dashboard")
    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        AppUser user = CurrentUser.require();
        List<TripSummary> all = trips.mine(user);
        LocalDate today = LocalDate.now();
        List<TripSummary> upcoming = all.stream().filter(t -> !t.endDate().isBefore(today))
                .sorted((a, b) -> a.startDate().compareTo(b.startDate())).toList();
        List<TripSummary> past = all.stream().filter(t -> t.endDate().isBefore(today)).toList();
        var memberships = members.findByUserId(user.id());
        var roomMap = rooms.findAllById(memberships.stream().map(m -> m.getRoomId()).toList());
        List<RoomSummary> roomList = roomMap.stream()
                .map(r -> new RoomSummary(r.getId(), r.getName(), members.countByRoomId(r.getId()), r.getOwnerId().equals(user.id())))
                .toList();
        return Map.of("upcoming", upcoming, "past", past, "saved", savedFor(user), "rooms", roomList,
                "unreadNotifications", notifications.countByUserIdAndReadFalse(user.id()));
    }

    @GetMapping("/notifications")
    public List<NotificationDto> notifications() {
        return notifications.findTop30ByUserIdOrderByCreatedAtDesc(CurrentUser.require().id()).stream()
                .map(MeController::dto).toList();
    }

    @PostMapping("/notifications/read")
    @Transactional
    public Map<String, Object> markRead() {
        return Map.of("updated", notifications.markAllRead(CurrentUser.require().id()));
    }

    private static NotificationDto dto(Notification n) {
        return new NotificationDto(n.getId(), n.getType(), n.getMessage(), n.getLink(), n.isRead(), n.getCreatedAt());
    }
}
