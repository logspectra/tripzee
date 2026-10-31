package com.tripzee.repo;

import com.tripzee.domain.SavedPlace;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedPlaceRepository extends JpaRepository<SavedPlace, String> {
    List<SavedPlace> findByUserIdOrderByCreatedAtDesc(String userId);

    Optional<SavedPlace> findByUserIdAndDestinationId(String userId, String destinationId);

    Optional<SavedPlace> findByUserIdAndExternalRef(String userId, String externalRef);

    long countByUserId(String userId);
}
