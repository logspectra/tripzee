package com.tripzee.repo;

import com.tripzee.domain.Trip;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripRepository extends JpaRepository<Trip, String> {
    List<Trip> findByOwnerIdOrderByStartDateDesc(String ownerId);

    Optional<Trip> findByShareToken(String shareToken);

    long countByCreatedAtAfter(Instant since);
}
