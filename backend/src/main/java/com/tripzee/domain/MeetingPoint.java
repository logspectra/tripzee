package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "meeting_points")
@Getter
@Setter
public class MeetingPoint extends BaseEntity {
    private String roomId;
    private String createdById;
    private String name;
    private double lat;
    private double lng;
    private Instant meetAt;
    private String note;
    private Instant createdAt = Instant.now();
}
