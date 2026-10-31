package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "reports")
@Getter
@Setter
public class Report extends BaseEntity {
    public static final String OPEN = "OPEN";

    private String reporterId;
    /** review | message */
    private String targetType;
    private String targetId;
    /** spam | offensive | misleading | other */
    private String reason;
    private String details;
    private String status = OPEN;
    private String resolvedById;
    private Instant createdAt = Instant.now();
}
