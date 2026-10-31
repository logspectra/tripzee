package com.tripzee.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "external_cache")
@Getter
@Setter
public class ExternalCache {
    @Id
    private String cacheKey;

    private String payload;
    private Instant fetchedAt = Instant.now();
}
