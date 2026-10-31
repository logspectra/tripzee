package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "notifications")
@Getter
@Setter
public class Notification extends BaseEntity {
    private String userId;
    private String type;
    private String message;
    private String link;

    @Column(name = "is_read")
    private boolean read;

    private Instant createdAt = Instant.now();
}
