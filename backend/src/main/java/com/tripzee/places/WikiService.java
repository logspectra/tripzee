package com.tripzee.places;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripzee.common.AppProperties;
import com.tripzee.domain.Destination;
import com.tripzee.domain.SourceReference;
import com.tripzee.repo.DestinationRepository;
import com.tripzee.repo.SourceReferenceRepository;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Pulls lead images and coordinates for destinations from the Wikipedia REST API and records
 * Wikipedia as a source. Images are never invented: if a lookup fails the UI shows a neutral placeholder.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WikiService {
    private final RestClient http;
    private final AppProperties props;
    private final DestinationRepository destinations;
    private final SourceReferenceRepository sources;

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void backfillOnStartup() {
        backfill();
    }

    /** Retries places whose lookup failed earlier (e.g. rate limiting or offline start). */
    @Scheduled(initialDelay = 30 * 60_000, fixedDelay = 6 * 3_600_000)
    public void backfill() {
        if (!props.externalLookups()) return;
        var ids = destinations.idsNeedingEnrichment();
        int ok = 0;
        for (String id : ids) {
            if (enrich(id)) ok++;
            try {
                Thread.sleep(1500); // stay well within Wikimedia's API rate limits
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        if (!ids.isEmpty()) log.info("Wikipedia enrichment: {}/{} destinations updated", ok, ids.size());
    }

    public boolean enrich(String destinationId) {
        Destination d = destinations.findById(destinationId).orElse(null);
        if (d == null || d.getWikiTitle() == null || !props.externalLookups()) return false;
        try {
            String title = URLEncoder.encode(d.getWikiTitle().replace(' ', '_'), StandardCharsets.UTF_8);
            JsonNode s = http.get().uri(URI.create("https://en.wikipedia.org/api/rest_v1/page/summary/" + title))
                    .retrieve().body(JsonNode.class);
            String thumb = s.path("thumbnail").path("source").asText(null);
            String original = s.path("originalimage").path("source").asText(null);
            boolean smallOriginal = s.path("originalimage").path("width").asInt(0) <= 1280;
            String image = thumb != null && !smallOriginal ? thumb.replaceFirst("/\\d+px-", "/1280px-") : original;
            if (d.getImageUrl() == null && image != null) {
                d.setImageUrl(image);
                d.setImageCredit("Wikimedia Commons via Wikipedia: " + s.path("title").asText());
            }
            JsonNode c = s.path("coordinates");
            if (d.getCoordsSource() == null && c.has("lat") && c.has("lon")) {
                d.setLat(c.path("lat").asDouble());
                d.setLng(c.path("lon").asDouble());
                d.setCoordsSource("Wikipedia");
            }
            destinations.save(d);
            String page = s.path("content_urls").path("desktop").path("page").asText("https://en.wikipedia.org/wiki/" + title);
            if (!sources.existsByDestinationIdAndUrl(d.getId(), page)) {
                SourceReference ref = new SourceReference();
                ref.setDestination(d);
                ref.setLabel("Wikipedia — " + s.path("title").asText());
                ref.setUrl(page);
                ref.setField("general");
                sources.save(ref);
            }
            return true;
        } catch (Exception e) {
            log.warn("Wikipedia lookup failed for {}: {}", d.getWikiTitle(), e.getMessage());
            return false;
        }
    }
}
