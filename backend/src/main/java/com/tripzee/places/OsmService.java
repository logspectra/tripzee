package com.tripzee.places;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.tripzee.common.ApiException;
import com.tripzee.common.AppProperties;
import com.tripzee.common.Geo;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * OpenStreetMap-backed lookups: geocoding (Nominatim), nearby places (Overpass with a
 * Nominatim fallback) and routing (OSRM). No API keys required; results cached in the DB.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OsmService {
    public static final String ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";

    private final RestClient http;
    private final AppProperties props;
    private final ExternalCacheService cache;

    // ---------- types ----------

    public record PlaceType(String key, String label, List<String> overpass, List<String> nominatim) {}

    public static final Map<String, PlaceType> PLACE_TYPES = types(
            new PlaceType("hotel", "Hotels & stays", List.of("nwr[\"tourism\"~\"^(hotel|hostel|guest_house|motel)$\"]"), List.of("hotel", "guest house", "hostel")),
            new PlaceType("restaurant", "Restaurants & cafés", List.of("nwr[\"amenity\"~\"^(restaurant|cafe|fast_food)$\"]"), List.of("restaurant", "cafe")),
            new PlaceType("hospital", "Hospitals & clinics", List.of("nwr[\"amenity\"~\"^(hospital|clinic)$\"]"), List.of("hospital", "clinic")),
            new PlaceType("pharmacy", "Pharmacies", List.of("nwr[\"amenity\"=\"pharmacy\"]"), List.of("pharmacy")),
            new PlaceType("police", "Police", List.of("nwr[\"amenity\"=\"police\"]"), List.of("police")),
            new PlaceType("atm", "ATMs & banks", List.of("nwr[\"amenity\"~\"^(atm|bank)$\"]"), List.of("atm", "bank")),
            new PlaceType("fuel", "Petrol stations", List.of("nwr[\"amenity\"=\"fuel\"]"), List.of("fuel")),
            new PlaceType("transport", "Public transport", List.of("nwr[\"railway\"=\"station\"]", "nwr[\"amenity\"=\"bus_station\"]"), List.of("railway station", "bus station")),
            new PlaceType("parking", "Parking", List.of("nwr[\"amenity\"=\"parking\"]"), List.of("parking")));

    private static Map<String, PlaceType> types(PlaceType... t) {
        Map<String, PlaceType> m = new LinkedHashMap<>();
        for (PlaceType p : t) m.put(p.key(), p);
        return m;
    }

    public record GeoResult(String name, String displayName, double lat, double lng, String type, String source) {}

    public record NearbyPlace(String id, String name, String type, String subtype, double lat, double lng, double distanceKm,
                              String address, String phone, String website, String openingHours, String cuisine,
                              String stars, String wheelchair, String osmUrl) {}

    public record NearbyResult(List<NearbyPlace> places, String source, String attribution, String fetchedAt) {}

    public record Step(String instruction, long distanceM) {}

    public record RouteResult(String mode, double distanceKm, long durationMin, List<double[]> geometry, List<Step> steps,
                              boolean approximate, String note, String source) {}

    // ---------- Nominatim ----------

    private final ReentrantLock nominatimLock = new ReentrantLock(true);
    private volatile long lastNominatimCall;

    /** Nominatim's usage policy allows at most one request per second. */
    private JsonNode nominatim(String pathAndQuery) {
        nominatimLock.lock();
        try {
            long wait = 1100 - (System.currentTimeMillis() - lastNominatimCall);
            if (wait > 0) Thread.sleep(wait);
            return http.get().uri(URI.create(props.osm().nominatimUrl() + pathAndQuery)).accept(MediaType.APPLICATION_JSON)
                    .retrieve().body(JsonNode.class);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted");
        } finally {
            lastNominatimCall = System.currentTimeMillis();
            nominatimLock.unlock();
        }
    }

    private void ensureExternal() {
        if (!props.externalLookups()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "External map lookups are disabled on this server");
        }
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() || v.asText().isBlank() ? null : v.asText();
    }

    public List<GeoResult> geocode(String q, int limit) {
        ensureExternal();
        String key = "geocode:" + q.toLowerCase(Locale.ROOT) + ":" + limit;
        return cache.cached(key, Duration.ofDays(7), new TypeReference<>() {}, () -> {
            JsonNode rows = nominatim("/search?format=jsonv2&countrycodes=in&limit=" + limit + "&q=" + enc(q));
            List<GeoResult> out = new ArrayList<>();
            for (JsonNode r : rows) {
                String display = r.path("display_name").asText();
                String name = text(r, "name");
                out.add(new GeoResult(name != null ? name : display.split(",")[0], display,
                        r.path("lat").asDouble(), r.path("lon").asDouble(), r.path("type").asText(), "OpenStreetMap"));
            }
            return out;
        });
    }

    // ---------- Nearby ----------

    public NearbyResult nearby(double lat, double lng, String type, int radiusM) {
        ensureExternal();
        PlaceType pt = PLACE_TYPES.get(type);
        if (pt == null) throw ApiException.badRequest("Unknown place type: " + type);
        String key = String.format(Locale.ROOT, "nearby:%s:%.3f,%.3f:%d", type, lat, lng, radiusM);
        return cache.cached(key, Duration.ofHours(24), new TypeReference<>() {}, () -> {
            String source = "overpass";
            List<NearbyPlace> places;
            try {
                places = overpass(lat, lng, pt, radiusM);
            } catch (Exception e) {
                log.warn("Overpass failed ({}), falling back to Nominatim", e.getMessage());
                source = "nominatim";
                places = nominatimNearby(lat, lng, pt, radiusM);
            }
            List<NearbyPlace> sorted = places.stream()
                    .sorted(Comparator.comparingDouble(NearbyPlace::distanceKm)).limit(60).toList();
            return new NearbyResult(sorted, source, ATTRIBUTION, Instant.now().toString());
        });
    }

    private List<NearbyPlace> overpass(double lat, double lng, PlaceType pt, int radiusM) {
        String filters = pt.overpass().stream()
                .map(f -> String.format(Locale.ROOT, "%s(around:%d,%f,%f);", f, radiusM, lat, lng))
                .collect(Collectors.joining());
        String query = "[out:json][timeout:20];(" + filters + ");out center tags 80;";
        RuntimeException last = new IllegalStateException("No Overpass endpoint configured");
        for (String url : props.osm().overpassUrls()) {
            try {
                JsonNode data = http.post().uri(URI.create(url)).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body("data=" + enc(query)).retrieve().body(JsonNode.class);
                List<NearbyPlace> out = new ArrayList<>();
                for (JsonNode el : data.path("elements")) {
                    JsonNode t = el.path("tags");
                    String name = text(t, "name:en") != null ? text(t, "name:en") : text(t, "name");
                    double pLat = el.has("lat") ? el.path("lat").asDouble() : el.path("center").path("lat").asDouble(Double.NaN);
                    double pLng = el.has("lon") ? el.path("lon").asDouble() : el.path("center").path("lon").asDouble(Double.NaN);
                    if (name == null || Double.isNaN(pLat) || Double.isNaN(pLng)) continue;
                    String id = el.path("type").asText() + "/" + el.path("id").asText();
                    String subtype = firstNonNull(text(t, "tourism"), text(t, "amenity"), text(t, "railway"));
                    String cuisine = text(t, "cuisine");
                    out.add(new NearbyPlace(id, name, pt.key(), subtype, pLat, pLng, Geo.round1(Geo.haversineKm(lat, lng, pLat, pLng)),
                            address(t), firstNonNull(text(t, "phone"), text(t, "contact:phone")),
                            firstNonNull(text(t, "website"), text(t, "contact:website")), text(t, "opening_hours"),
                            cuisine == null ? null : cuisine.replace(";", ", "), text(t, "stars"), text(t, "wheelchair"),
                            "https://www.openstreetmap.org/" + id));
                }
                return out;
            } catch (RuntimeException e) {
                last = e;
            }
        }
        throw last;
    }

    private List<NearbyPlace> nominatimNearby(double lat, double lng, PlaceType pt, int radiusM) {
        double deg = radiusM / 111_000.0;
        String viewbox = String.format(Locale.ROOT, "%f,%f,%f,%f", lng - deg, lat + deg, lng + deg, lat - deg);
        Set<String> seen = new HashSet<>();
        List<NearbyPlace> out = new ArrayList<>();
        for (String term : pt.nominatim()) {
            JsonNode rows = nominatim("/search?format=jsonv2&limit=30&bounded=1&extratags=1&viewbox=" + viewbox + "&q=" + enc(term));
            for (JsonNode r : rows) {
                String id = r.path("osm_type").asText() + "/" + r.path("osm_id").asText();
                String name = text(r, "name");
                if (name == null || !seen.add(id)) continue;
                double pLat = r.path("lat").asDouble();
                double pLng = r.path("lon").asDouble();
                JsonNode x = r.path("extratags");
                String[] parts = r.path("display_name").asText().split(",");
                String addr = parts.length > 1 ? String.join(",", java.util.Arrays.copyOfRange(parts, 1, Math.min(parts.length, 4))).trim() : null;
                out.add(new NearbyPlace(id, name, pt.key(), r.path("type").asText(), pLat, pLng,
                        Geo.round1(Geo.haversineKm(lat, lng, pLat, pLng)), addr,
                        firstNonNull(text(x, "phone"), text(x, "contact:phone")),
                        firstNonNull(text(x, "website"), text(x, "contact:website")), text(x, "opening_hours"),
                        text(x, "cuisine"), text(x, "stars"), text(x, "wheelchair"), "https://www.openstreetmap.org/" + id));
            }
        }
        return out;
    }

    private static String address(JsonNode t) {
        List<String> parts = new ArrayList<>();
        for (String f : List.of("addr:housenumber", "addr:street", "addr:suburb", "addr:city")) {
            String v = text(t, f);
            if (v != null) parts.add(v);
        }
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        for (T v : values) if (v != null) return v;
        return null;
    }

    // ---------- Routing ----------

    public RouteResult route(double fromLat, double fromLng, double toLat, double toLng, String mode) {
        String m = "walking".equals(mode) ? "walking" : "driving";
        if (!props.externalLookups()) {
            return straightLine(fromLat, fromLng, toLat, toLng, m, "Routing service disabled — showing a straight-line estimate (×1.3).");
        }
        String profile = "walking".equals(m) ? "routed-foot/route/v1/foot" : "routed-car/route/v1/driving";
        String coords = String.format(Locale.ROOT, "%f,%f;%f,%f", fromLng, fromLat, toLng, toLat);
        try {
            return cache.cached("route:" + m + ":" + coords, Duration.ofDays(7), new TypeReference<>() {}, () -> {
                JsonNode data = http.get()
                        .uri(URI.create(props.osm().osrmUrl() + "/" + profile + "/" + coords + "?overview=full&geometries=geojson&steps=true"))
                        .retrieve().body(JsonNode.class);
                JsonNode r = data.path("routes").path(0);
                if (!"Ok".equals(data.path("code").asText()) || r.isMissingNode()) {
                    throw new IllegalStateException("OSRM: " + data.path("code").asText());
                }
                List<double[]> geometry = new ArrayList<>();
                for (JsonNode c : r.path("geometry").path("coordinates")) geometry.add(new double[]{c.get(1).asDouble(), c.get(0).asDouble()});
                List<Step> steps = new ArrayList<>();
                for (JsonNode leg : r.path("legs")) {
                    for (JsonNode s : leg.path("steps")) steps.add(new Step(describe(s), Math.round(s.path("distance").asDouble())));
                }
                return new RouteResult(m, Geo.round1(r.path("distance").asDouble() / 1000), Math.round(r.path("duration").asDouble() / 60),
                        geometry, steps, false, null, "OSRM on OpenStreetMap data");
            });
        } catch (RuntimeException e) {
            log.warn("Routing failed: {}", e.getMessage());
            return straightLine(fromLat, fromLng, toLat, toLng, m, "Routing service unavailable — showing a straight-line estimate (×1.3). Times are rough.");
        }
    }

    static RouteResult straightLine(double fromLat, double fromLng, double toLat, double toLng, String mode, String note) {
        double km = Geo.haversineKm(fromLat, fromLng, toLat, toLng) * 1.3;
        double speed = "walking".equals(mode) ? 4.5 : 35;
        return new RouteResult(mode, Geo.round1(km), Math.round(km / speed * 60),
                List.of(new double[]{fromLat, fromLng}, new double[]{toLat, toLng}), List.of(), true, note, "Straight-line estimate");
    }

    static String describe(JsonNode s) {
        String name = text(s, "name");
        String road = name != null ? " onto " + name : "";
        String type = s.path("maneuver").path("type").asText();
        String modifier = text(s.path("maneuver"), "modifier");
        return switch (type) {
            case "depart" -> "Head out" + (name != null ? " on " + name : "");
            case "arrive" -> "Arrive at your destination";
            case "roundabout", "rotary" -> "Take the roundabout" + road;
            case "merge" -> "Merge" + road;
            case "fork" -> "Keep " + (modifier != null ? modifier : "ahead") + " at the fork" + road;
            case "continue", "new name" -> "Continue" + road;
            default -> (modifier != null ? "Turn " + modifier : "Proceed") + road;
        };
    }
}
