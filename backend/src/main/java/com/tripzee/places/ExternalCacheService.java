package com.tripzee.places;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripzee.domain.ExternalCache;
import com.tripzee.repo.ExternalCacheRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** DB-backed cache for slow or rate-limited external APIs (survives restarts). */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExternalCacheService {
    private final ExternalCacheRepository repo;
    private final ObjectMapper mapper;

    public <T> T cached(String key, Duration ttl, TypeReference<T> type, Supplier<T> loader) {
        String k = key.length() > 300 ? key.substring(0, 300) : key;
        var hit = repo.findById(k).orElse(null);
        if (hit != null && hit.getFetchedAt().plus(ttl).isAfter(Instant.now())) {
            try {
                return mapper.readValue(hit.getPayload(), type);
            } catch (Exception e) {
                log.warn("Discarding unreadable cache entry {}", k);
            }
        }
        T value = loader.get();
        try {
            ExternalCache row = hit != null ? hit : new ExternalCache();
            row.setCacheKey(k);
            row.setPayload(mapper.writeValueAsString(value));
            row.setFetchedAt(Instant.now());
            repo.save(row);
        } catch (Exception e) {
            log.warn("Could not cache {}: {}", k, e.getMessage());
        }
        return value;
    }
}
