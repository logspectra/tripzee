package com.tripzee.repo;

import com.tripzee.domain.RoomMessage;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomMessageRepository extends JpaRepository<RoomMessage, String> {
    @EntityGraph(attributePaths = "user")
    List<RoomMessage> findTop100ByRoomIdOrderByCreatedAtDesc(String roomId);
}
