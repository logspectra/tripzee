package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "destinations")
@Getter
@Setter
public class Destination extends BaseEntity {
    private String slug;
    private String name;
    private String nameHi;
    private String city;
    private String state = "Uttar Pradesh";
    private String country = "India";

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private Category category;

    private double lat;
    private double lng;
    private String coordsSource;
    private String summary;
    private String summaryHi;
    private String description;
    private String history;
    private String culturalSignificance;
    private String interests = "";

    // Practical facts: null means "not verified" — never filled with guesses.
    private String openingHours;
    private String entryFee;
    private int visitMinutes = 120;
    private String bestTimeToVisit;
    private String accessibility;
    private String guidelines;
    private String officialUrl;
    private String ticketUrl;
    private boolean factsVerified;
    private Instant lastVerifiedAt;

    private String wikiTitle;
    private String imageUrl;
    private String imageCredit;
    private boolean published = true;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "destination", fetch = FetchType.LAZY)
    @OrderBy("createdAt")
    private List<SourceReference> sources = new ArrayList<>();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public List<String> interestList() {
        return interests == null || interests.isBlank() ? List.of()
                : Arrays.stream(interests.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
