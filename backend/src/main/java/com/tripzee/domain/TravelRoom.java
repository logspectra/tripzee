package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "travel_rooms")
@Getter
@Setter
public class TravelRoom extends BaseEntity {
    private String name;
    private String inviteCode;
    private String ownerId;
    private String tripId;
    private Instant createdAt = Instant.now();
}
