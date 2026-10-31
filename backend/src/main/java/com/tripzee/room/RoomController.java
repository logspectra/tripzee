package com.tripzee.room;

import com.tripzee.auth.CurrentUser;
import com.tripzee.room.RoomDtos.LocationDto;
import com.tripzee.room.RoomDtos.MeetingPointDto;
import com.tripzee.room.RoomDtos.MessageDto;
import com.tripzee.room.RoomDtos.RoomDetail;
import com.tripzee.room.RoomDtos.RoomSummary;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** All writes go through REST (validated + authorized); WebSocket is used only to push events to members. */
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {
    private final RoomService rooms;

    @GetMapping
    public List<RoomSummary> mine() {
        return rooms.mine(CurrentUser.require());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomDetail create(@Valid @RequestBody RoomDtos.CreateRoomRequest body) {
        return rooms.create(body, CurrentUser.require());
    }

    @PostMapping("/join")
    public RoomDetail join(@Valid @RequestBody RoomDtos.JoinRequest body) {
        return rooms.join(body.code(), CurrentUser.require());
    }

    @GetMapping("/{id}")
    public RoomDetail detail(@PathVariable String id) {
        return rooms.detail(id, CurrentUser.require());
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable String id) {
        rooms.delete(id, CurrentUser.require());
        return Map.of("ok", true);
    }

    @PostMapping("/{id}/leave")
    public Map<String, Object> leave(@PathVariable String id) {
        rooms.leave(id, CurrentUser.require());
        return Map.of("ok", true);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public Map<String, Object> kick(@PathVariable String id, @PathVariable String userId) {
        rooms.kick(id, userId, CurrentUser.require());
        return Map.of("ok", true);
    }

    @PostMapping("/{id}/invite/rotate")
    public Map<String, Object> rotate(@PathVariable String id) {
        return Map.of("inviteCode", rooms.rotateInvite(id, CurrentUser.require()));
    }

    @PutMapping("/{id}/trip")
    public RoomDetail linkTrip(@PathVariable String id, @Valid @RequestBody RoomDtos.LinkTripRequest body) {
        return rooms.linkTrip(id, body.tripId(), CurrentUser.require());
    }

    @PostMapping("/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageDto message(@PathVariable String id, @Valid @RequestBody RoomDtos.MessageRequest body) {
        return rooms.postMessage(id, body.body(), body.kind(), CurrentUser.require());
    }

    @PostMapping("/{id}/sharing")
    public Map<String, Object> sharing(@PathVariable String id, @Valid @RequestBody RoomDtos.SharingRequest body) {
        return rooms.setSharing(id, body.enabled(), CurrentUser.require());
    }

    @PostMapping("/{id}/location")
    public LocationDto location(@PathVariable String id, @Valid @RequestBody RoomDtos.LocationRequest body) {
        return rooms.updateLocation(id, body, CurrentUser.require());
    }

    @PostMapping("/{id}/meeting-points")
    @ResponseStatus(HttpStatus.CREATED)
    public MeetingPointDto addMeetingPoint(@PathVariable String id, @Valid @RequestBody RoomDtos.MeetingPointRequest body) {
        return rooms.addMeetingPoint(id, body, CurrentUser.require());
    }

    @DeleteMapping("/{id}/meeting-points/{pointId}")
    public Map<String, Object> deleteMeetingPoint(@PathVariable String id, @PathVariable String pointId) {
        rooms.deleteMeetingPoint(id, pointId, CurrentUser.require());
        return Map.of("ok", true);
    }
}
