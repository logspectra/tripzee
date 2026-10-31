package com.tripzee.auth;

import com.tripzee.common.ApiException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Sliding-window limiter per key (client IP + action) for auth and LLM-backed endpoints. */
// ponytail: in-memory, per instance. Move to Redis/bucket4j when running more than one replica.
@Component
public class LoginRateLimiter {
    static final int LIMIT = 20;
    static final long WINDOW_MS = 15 * 60_000L;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public void check(String key) {
        check(key, LIMIT, WINDOW_MS);
    }

    public void check(String key, int limit, long windowMs) {
        long now = System.currentTimeMillis();
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > windowMs) q.pollFirst();
            if (q.size() >= limit) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Please wait a few minutes and try again.");
            }
            q.addLast(now);
        }
    }

    public void reset() {
        hits.clear();
    }
}
