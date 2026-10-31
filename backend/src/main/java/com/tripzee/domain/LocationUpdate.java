package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "location_updates")
@Getter
@Setter
public class LocationUpdate extends BaseEntity {
    private String roomId;
    private String userId;
    private double lat;
    private double lng;
    private Double accuracy;
    private Instant updatedAt = Instant.now();
}
