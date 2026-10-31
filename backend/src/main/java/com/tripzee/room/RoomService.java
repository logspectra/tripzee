package com.tripzee.room;

import com.tripzee.auth.AppUser;
import com.tripzee.common.ApiException;
import com.tripzee.domain.LocationUpdate;
import com.tripzee.domain.MeetingPoint;
import com.tripzee.domain.RoomMember;
import com.tripzee.domain.RoomMessage;
import com.tripzee.domain.TravelRoom;
import com.tripzee.domain.Trip;
import com.tripzee.me.NotificationService;
import com.tripzee.repo.LocationUpdateRepository;
import com.tripzee.repo.MeetingPointRepository;
import com.tripzee.repo.RoomMemberRepository;
import com.tripzee.repo.RoomMessageRepository;
import com.tripzee.repo.TravelRoomRepository;
import com.tripzee.repo.TripRepository;
import com.tripzee.repo.UserRepository;
import com.tripzee.room.RoomDtos.LocationDto;
import com.tripzee.room.RoomDtos.MeetingPointDto;
import com.tripzee.room.RoomDtos.MemberDto;
import com.tripzee.room.RoomDtos.MessageDto;
import com.tripzee.room.RoomDtos.RoomDetail;
import com.tripzee.room.RoomDtos.RoomEvent;
import com.tripzee.room.RoomDtos.RoomSummary;
import com.tripzee.room.RoomDtos.TripRef;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Travel Room collaboration. Location privacy rules:
 *  - a member's position is accepted only while that member has opted in (sharingLocation = true);
 *  - only the latest position is stored, and it is deleted the moment sharing is turned off;
 *  - positions are only ever returned/pushed to members of the same room; stale positions expire.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RoomService {
    static final Duration LOCATION_TTL = Duration.ofMinutes(30);
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final TravelRoomRepository rooms;
    private final RoomMemberRepository members;
    private final RoomMessageRepository messages;
    private final MeetingPointRepository meetingPoints;
    private final LocationUpdateRepository locations;
    private final TripRepository trips;
    private final UserRepository users;
    private final NotificationService notifications;
    private final SimpMessagingTemplate broker;

    public static String topic(String roomId) {
        return "/topic/rooms/" + roomId;
    }

    /** Push after commit so subscribers never see uncommitted state. */
    private void publish(String roomId, String type, Object payload) {
        Runnable send = () -> broker.convertAndSend(topic(roomId), new RoomEvent(type, payload));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }

    // ---------- access ----------

    public boolean isMember(String roomId, String userId) {
        return members.existsByRoomIdAndUserId(roomId, userId);
    }

    private TravelRoom room(String id) {
        return rooms.findById(id).orElseThrow(() -> ApiException.notFound("Travel Room"));
    }

    private RoomMember requireMember(String roomId, AppUser user) {
        return members.findByRoomIdAndUserId(roomId, user.id()).orElseThrow(() -> ApiException.notFound("Travel Room"));
    }

    private TravelRoom requireOwner(String roomId, AppUser user) {
        TravelRoom r = room(roomId);
        requireMember(roomId, user);
        if (!r.getOwnerId().equals(user.id())) throw ApiException.forbidden();
        return r;
    }

    // ---------- lifecycle ----------

    @Transactional
    public RoomDetail create(RoomDtos.CreateRoomRequest req, AppUser user) {
        TravelRoom r = new TravelRoom();
        r.setName(req.name().trim());
        r.setOwnerId(user.id());
        r.setInviteCode(newCode());
        if (req.tripId() != null && !req.tripId().isBlank()) r.setTripId(ownedTrip(req.tripId(), user).getId());
        rooms.save(r);
        RoomMember m = new RoomMember();
        m.setRoomId(r.getId());
        m.setUserId(user.id());
        m.setUser(users.getReferenceById(user.id()));
        m.setRole(RoomMember.OWNER);
        members.save(m);
        return detail(r.getId(), user);
    }

    private Trip ownedTrip(String tripId, AppUser user) {
        Trip t = trips.findById(tripId).orElseThrow(() -> ApiException.notFound("Trip"));
        if (!t.getOwnerId().equals(user.id())) throw ApiException.forbidden();
        return t;
    }

    String newCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            if (!rooms.existsByInviteCode(sb.toString())) return sb.toString();
        }
        throw new IllegalStateException("Could not allocate invite code");
    }

    @Transactional
    public RoomDetail join(String code, AppUser user) {
        TravelRoom r = rooms.findByInviteCode(code.trim().toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "No Travel Room matches that code"));
        if (!members.existsByRoomIdAndUserId(r.getId(), user.id())) {
            if (members.countByRoomId(r.getId()) >= 50) throw ApiException.badRequest("This Travel Room is full (50 members)");
            RoomMember m = new RoomMember();
            m.setRoomId(r.getId());
            m.setUserId(user.id());
            m.setUser(users.getReferenceById(user.id()));
            members.save(m);
            systemMessage(r.getId(), user, user.name() + " joined the room");
            notifications.notify(r.getOwnerId(), "room_join", user.name() + " joined your Travel Room \"" + r.getName() + "\"", "/rooms/" + r.getId());
            publish(r.getId(), "member-joined", new MemberDto(user.id(), user.name(), RoomMember.MEMBER, false, false, m.getJoinedAt()));
        }
        return detail(r.getId(), user);
    }

    @Transactional
    public void leave(String roomId, AppUser user) {
        TravelRoom r = room(roomId);
        RoomMember m = requireMember(roomId, user);
        if (r.getOwnerId().equals(user.id())) throw ApiException.badRequest("Owners can't leave their own room — delete it instead");
        removeMember(r, m, user.name() + " left the room");
    }

    @Transactional
    public void kick(String roomId, String userId, AppUser owner) {
        TravelRoom r = requireOwner(roomId, owner);
        if (userId.equals(owner.id())) throw ApiException.badRequest("You can't remove yourself");
        RoomMember m = members.findByRoomIdAndUserId(roomId, userId).orElseThrow(() -> ApiException.notFound("Member"));
        removeMember(r, m, null);
        notifications.notify(userId, "room_removed", "You were removed from the Travel Room \"" + r.getName() + "\"", null);
    }

    private void removeMember(TravelRoom r, RoomMember m, String systemText) {
        locations.deleteByRoomIdAndUserId(r.getId(), m.getUserId());
        members.delete(m);
        if (systemText != null) {
            RoomMessage msg = new RoomMessage();
            msg.setRoomId(r.getId());
            msg.setUserId(m.getUserId());
            msg.setUser(users.getReferenceById(m.getUserId()));
            msg.setBody(systemText);
            msg.setKind("update");
            messages.save(msg);
        }
        publish(r.getId(), "location-removed", Map.of("userId", m.getUserId()));
        publish(r.getId(), "member-left", Map.of("userId", m.getUserId()));
    }

    @Transactional
    public void delete(String roomId, AppUser user) {
        TravelRoom r = requireOwner(roomId, user);
        publish(roomId, "room-deleted", Map.of("id", roomId));
        rooms.delete(r);
    }

    @Transactional
    public String rotateInvite(String roomId, AppUser user) {
        TravelRoom r = requireOwner(roomId, user);
        r.setInviteCode(newCode());
        rooms.save(r);
        return r.getInviteCode();
    }

    @Transactional
    public RoomDetail linkTrip(String roomId, String tripId, AppUser user) {
        TravelRoom r = requireOwner(roomId, user);
        r.setTripId(tripId == null || tripId.isBlank() ? null : ownedTrip(tripId, user).getId());
        rooms.save(r);
        publish(roomId, "trip-linked", Map.of("tripId", r.getTripId() == null ? "" : r.getTripId()));
        return detail(roomId, user);
    }

    // ---------- messages ----------

    @Transactional
    public MessageDto postMessage(String roomId, String body, String kind, AppUser user) {
        requireMember(roomId, user);
        RoomMessage m = new RoomMessage();
        m.setRoomId(roomId);
        m.setUserId(user.id());
        m.setUser(users.getReferenceById(user.id()));
        m.setBody(body.trim());
        m.setKind(kind == null ? "message" : kind);
        messages.save(m);
        MessageDto dto = new MessageDto(m.getId(), user.id(), user.name(), m.getBody(), m.getKind(), m.getCreatedAt());
        publish(roomId, "message", dto);
        return dto;
    }

    private void systemMessage(String roomId, AppUser user, String text) {
        RoomMessage m = new RoomMessage();
        m.setRoomId(roomId);
        m.setUserId(user.id());
        m.setUser(users.getReferenceById(user.id()));
        m.setBody(text);
        m.setKind("update");
        messages.save(m);
        publish(roomId, "message", new MessageDto(m.getId(), user.id(), user.name(), text, "update", m.getCreatedAt()));
    }

    // ---------- location sharing ----------

    @Transactional
    public Map<String, Object> setSharing(String roomId, boolean enabled, AppUser user) {
        RoomMember m = requireMember(roomId, user);
        m.setSharingLocation(enabled);
        if (enabled) {
            m.setConsentAt(Instant.now());
        } else {
            locations.deleteByRoomIdAndUserId(roomId, user.id());
            publish(roomId, "location-removed", Map.of("userId", user.id()));
        }
        members.save(m);
        publish(roomId, "member-sharing", Map.of("userId", user.id(), "sharingLocation", enabled));
        return Map.of("sharingLocation", enabled);
    }

    @Transactional
    public LocationDto updateLocation(String roomId, RoomDtos.LocationRequest req, AppUser user) {
        RoomMember m = requireMember(roomId, user);
        if (!m.isSharingLocation()) {
            throw ApiException.forbidden(); // no consent → never store or broadcast
        }
        LocationUpdate l = locations.findByRoomIdAndUserId(roomId, user.id()).orElseGet(LocationUpdate::new);
        l.setRoomId(roomId);
        l.setUserId(user.id());
        l.setLat(req.lat());
        l.setLng(req.lng());
        l.setAccuracy(req.accuracy());
        l.setUpdatedAt(Instant.now());
        locations.save(l);
        LocationDto dto = new LocationDto(user.id(), user.name(), l.getLat(), l.getLng(), l.getAccuracy(), l.getUpdatedAt());
        publish(roomId, "location", dto);
        return dto;
    }

    @Scheduled(fixedDelay = 10 * 60_000)
    @Transactional
    public void purgeStaleLocations() {
        int n = locations.deleteStale(Instant.now().minus(Duration.ofHours(2)));
        if (n > 0) log.info("Purged {} stale shared locations", n);
    }

    // ---------- meeting points ----------

    @Transactional
    public MeetingPointDto addMeetingPoint(String roomId, RoomDtos.MeetingPointRequest req, AppUser user) {
        requireMember(roomId, user);
        if (meetingPoints.findByRoomIdOrderByCreatedAt(roomId).size() >= 30) throw ApiException.badRequest("A room can have up to 30 meeting points");
        MeetingPoint p = new MeetingPoint();
        p.setRoomId(roomId);
        p.setCreatedById(user.id());
        p.setName(req.name().trim());
        p.setLat(req.lat());
        p.setLng(req.lng());
        p.setMeetAt(req.meetAt());
        p.setNote(req.note());
        meetingPoints.save(p);
        MeetingPointDto dto = dto(p);
        publish(roomId, "meeting-point", dto);
        systemMessage(roomId, user, user.name() + " added meeting point \"" + p.getName() + "\"");
        return dto;
    }

    @Transactional
    public void deleteMeetingPoint(String roomId, String pointId, AppUser user) {
        TravelRoom r = room(roomId);
        requireMember(roomId, user);
        MeetingPoint p = meetingPoints.findById(pointId).filter(x -> x.getRoomId().equals(roomId))
                .orElseThrow(() -> ApiException.notFound("Meeting point"));
        if (!p.getCreatedById().equals(user.id()) && !r.getOwnerId().equals(user.id())) throw ApiException.forbidden();
        meetingPoints.delete(p);
        publish(roomId, "meeting-point-removed", Map.of("id", pointId));
    }

    // ---------- read ----------

    @Transactional(readOnly = true)
    public List<RoomSummary> mine(AppUser user) {
        Set<String> ids = members.findByUserId(user.id()).stream().map(RoomMember::getRoomId).collect(Collectors.toSet());
        if (ids.isEmpty()) return List.of();
        return rooms.findByIdInOrderByCreatedAtDesc(ids).stream()
                .map(r -> new RoomSummary(r.getId(), r.getName(), (int) members.countByRoomId(r.getId()), r.getOwnerId().equals(user.id()),
                        tripRef(r.getTripId()), r.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public RoomDetail detail(String roomId, AppUser user) {
        TravelRoom r = room(roomId);
        RoomMember me = requireMember(roomId, user);
        List<RoomMember> all = members.findByRoomIdOrderByJoinedAt(roomId);
        Map<String, RoomMember> byUser = all.stream().collect(Collectors.toMap(RoomMember::getUserId, x -> x));
        List<MemberDto> memberDtos = all.stream().map(m -> new MemberDto(m.getUserId(), m.getUser().getName(), m.getRole(),
                m.isSharingLocation(), m.getUserId().equals(user.id()), m.getJoinedAt())).toList();
        List<MessageDto> msgs = new ArrayList<>(messages.findTop100ByRoomIdOrderByCreatedAtDesc(roomId).stream()
                .map(m -> new MessageDto(m.getId(), m.getUserId(), m.getUser().getName(), m.getBody(), m.getKind(), m.getCreatedAt())).toList());
        Collections.reverse(msgs);
        List<LocationDto> locs = locations.findByRoomIdAndUpdatedAtAfter(roomId, Instant.now().minus(LOCATION_TTL)).stream()
                .filter(l -> byUser.containsKey(l.getUserId()) && byUser.get(l.getUserId()).isSharingLocation())
                .map(l -> new LocationDto(l.getUserId(), byUser.get(l.getUserId()).getUser().getName(), l.getLat(), l.getLng(), l.getAccuracy(), l.getUpdatedAt()))
                .toList();
        return new RoomDetail(r.getId(), r.getName(), r.getInviteCode(), r.getOwnerId().equals(user.id()), tripRef(r.getTripId()),
                memberDtos, msgs, meetingPoints.findByRoomIdOrderByCreatedAt(roomId).stream().map(RoomService::dto).toList(),
                locs, me.isSharingLocation(), r.getCreatedAt());
    }

    private TripRef tripRef(String tripId) {
        if (tripId == null) return null;
        return trips.findById(tripId).map(t -> new TripRef(t.getId(), t.getTitle(), t.getCity(), t.getStartDate().toString(), t.getEndDate().toString()))
                .orElse(null);
    }

    private static MeetingPointDto dto(MeetingPoint p) {
        return new MeetingPointDto(p.getId(), p.getName(), p.getLat(), p.getLng(), p.getMeetAt(), p.getNote(), p.getCreatedById(), p.getCreatedAt());
    }
}
