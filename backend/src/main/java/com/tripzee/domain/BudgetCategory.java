package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "budget_categories")
@Getter
@Setter
public class BudgetCategory extends BaseEntity {
    private String tripId;
    /** transport | accommodation | food | tickets | misc */
    private String category;
    private int planned;
    /** Human-readable explanation of how the estimate was produced. */
    private String basis;
}
