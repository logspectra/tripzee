package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "saved_places")
@Getter
@Setter
public class SavedPlace extends BaseEntity {
    private String userId;
    private String destinationId;
    /** OpenStreetMap reference like "node/123" for places outside the curated catalogue. */
    private String externalRef;
    private String name;
    private String kind;
    private Double lat;
    private Double lng;
    private Instant createdAt = Instant.now();
}
