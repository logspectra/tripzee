package com.tripzee.room;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

public final class RoomDtos {
    private RoomDtos() {}

    public record CreateRoomRequest(@NotBlank @Size(min = 2, max = 120) String name, @Size(max = 36) String tripId) {}

    public record JoinRequest(@NotBlank @Pattern(regexp = "^[A-Za-z0-9]{6,12}$") String code) {}

    public record LinkTripRequest(@Size(max = 36) String tripId) {}

    public record MessageRequest(@NotBlank @Size(max = 2000) String body, @Pattern(regexp = "message|update") String kind) {}

    public record SharingRequest(@NotNull Boolean enabled) {}

    public record LocationRequest(@NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
                                  @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
                                  @PositiveOrZero Double accuracy) {}

    public record MeetingPointRequest(@NotBlank @Size(max = 120) String name,
                                      @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
                                      @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
                                      Instant meetAt, @Size(max = 500) String note) {}

    public record MemberDto(String userId, String name, String role, boolean sharingLocation, boolean isMe, Instant joinedAt) {}

    public record MessageDto(String id, String userId, String userName, String body, String kind, Instant createdAt) {}

    public record MeetingPointDto(String id, String name, double lat, double lng, Instant meetAt, String note,
                                  String createdById, Instant createdAt) {}

    public record LocationDto(String userId, String name, double lat, double lng, Double accuracy, Instant updatedAt) {}

    public record TripRef(String id, String title, String city, String startDate, String endDate) {}

    public record RoomSummary(String id, String name, int memberCount, boolean isOwner, TripRef trip, Instant createdAt) {}

    public record RoomDetail(String id, String name, String inviteCode, boolean isOwner, TripRef trip, List<MemberDto> members,
                             List<MessageDto> messages, List<MeetingPointDto> meetingPoints, List<LocationDto> locations,
                             boolean mySharing, Instant createdAt) {}

    /** Envelope pushed to /topic/rooms/{id}. */
    public record RoomEvent(String type, Object payload) {}
}
