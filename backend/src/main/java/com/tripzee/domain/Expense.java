package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "expenses")
@Getter
@Setter
public class Expense extends BaseEntity {
    private String tripId;
    private String userId;
    private String category;
    private int amount;
    private String note;
    private LocalDate spentOn = LocalDate.now();
    private Instant createdAt = Instant.now();
}
