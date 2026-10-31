package com.tripzee.common;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tripzee")
public record AppProperties(
        String adminEmail,
        String adminPassword,
        List<String> allowedOrigins,
        boolean externalLookups,
        Llm llm,
        Osm osm) {

    public record Llm(String apiKey, String baseUrl, String model) {
        public boolean enabled() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    public record Osm(String userAgent, String nominatimUrl, String osrmUrl, List<String> overpassUrls) {}
}
