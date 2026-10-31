package com.tripzee.repo;

import com.tripzee.domain.LocationUpdate;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LocationUpdateRepository extends JpaRepository<LocationUpdate, String> {
    Optional<LocationUpdate> findByRoomIdAndUserId(String roomId, String userId);

    List<LocationUpdate> findByRoomIdAndUpdatedAtAfter(String roomId, Instant since);

    @Modifying
    @Query("delete from LocationUpdate l where l.roomId = :roomId and l.userId = :userId")
    void deleteByRoomIdAndUserId(@Param("roomId") String roomId, @Param("userId") String userId);

    @Modifying
    @Query("delete from LocationUpdate l where l.updatedAt < :before")
    int deleteStale(@Param("before") Instant before);
}
