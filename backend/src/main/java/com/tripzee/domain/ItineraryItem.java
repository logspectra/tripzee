package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "itinerary_items")
@Getter
@Setter
public class ItineraryItem extends BaseEntity {
    private String tripId;
    private int dayNumber;
    private int sortOrder;
    private String startTime;
    private String endTime;
    private String title;
    /** attraction | food | travel | stay | other */
    private String kind;
    private String destinationId;
    private Double lat;
    private Double lng;
    private String notes;
    private int estCost;
}
