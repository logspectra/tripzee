package com.tripzee.repo;

import com.tripzee.domain.MeetingPoint;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MeetingPointRepository extends JpaRepository<MeetingPoint, String> {
    List<MeetingPoint> findByRoomIdOrderByCreatedAt(String roomId);
}
