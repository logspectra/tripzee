package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "trips")
@Getter
@Setter
public class Trip extends BaseEntity {
    private String ownerId;
    private String title;
    private String origin;
    private Double originLat;
    private Double originLng;
    private String city;
    private LocalDate startDate;
    private LocalDate endDate;
    private int travellers;
    private int budget;
    private String interests = "";
    private String transport;
    private String pace;
    private String generatedBy = "rules";
    private String notes;
    private String shareToken;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public int days() {
        return (int) (endDate.toEpochDay() - startDate.toEpochDay()) + 1;
    }
}
