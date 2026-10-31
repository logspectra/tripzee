package com.tripzee.repo;

import com.tripzee.domain.SourceReference;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SourceReferenceRepository extends JpaRepository<SourceReference, String> {
    List<SourceReference> findByDestinationIdOrderByCreatedAt(String destinationId);

    boolean existsByDestinationIdAndUrl(String destinationId, String url);
}
