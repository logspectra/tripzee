package com.tripzee.repo;

import com.tripzee.domain.RoomMember;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomMemberRepository extends JpaRepository<RoomMember, String> {
    Optional<RoomMember> findByRoomIdAndUserId(String roomId, String userId);

    boolean existsByRoomIdAndUserId(String roomId, String userId);

    @EntityGraph(attributePaths = "user")
    List<RoomMember> findByRoomIdOrderByJoinedAt(String roomId);

    List<RoomMember> findByUserId(String userId);

    long countByRoomId(String roomId);
}
