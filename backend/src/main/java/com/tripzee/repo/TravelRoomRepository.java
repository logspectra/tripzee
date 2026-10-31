package com.tripzee.repo;

import com.tripzee.domain.TravelRoom;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TravelRoomRepository extends JpaRepository<TravelRoom, String> {
    Optional<TravelRoom> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);

    List<TravelRoom> findByTripId(String tripId);

    List<TravelRoom> findByIdInOrderByCreatedAtDesc(Collection<String> ids);
}
