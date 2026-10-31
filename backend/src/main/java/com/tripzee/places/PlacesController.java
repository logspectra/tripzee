package com.tripzee.places;

import com.tripzee.common.ApiException;
import com.tripzee.common.Geo;
import com.tripzee.destination.DestinationDtos.DestinationCard;
import com.tripzee.destination.DestinationService;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PlacesController {
    private final OsmService osm;
    private final DestinationService destinations;

    public record SearchResponse(List<DestinationCard> destinations, List<OsmService.GeoResult> places, String placesError) {}

    /** Unified search: curated Tripzee destinations first, then OpenStreetMap places. */
    @GetMapping("/search")
    public SearchResponse search(@RequestParam String q) {
        String query = q.trim();
        if (query.length() < 2 || query.length() > 120) throw ApiException.badRequest("Search text must be 2–120 characters");
        List<DestinationCard> curated = destinations.search(new DestinationService.SearchQuery(query, null, null, null, "name", 1, 8)).items();
        List<OsmService.GeoResult> places = new ArrayList<>();
        String error = null;
        try {
            places = osm.geocode(query, 6);
        } catch (Exception e) {
            log.warn("Geocode failed: {}", e.getMessage());
            error = "Map search is temporarily unavailable — showing Tripzee destinations only.";
        }
        return new SearchResponse(curated, places, error);
    }

    @GetMapping("/geocode")
    public List<OsmService.GeoResult> geocode(@RequestParam String q) {
        if (q.isBlank() || q.length() > 120) throw ApiException.badRequest("Invalid query");
        return osm.geocode(q.trim(), 5);
    }

    @GetMapping("/places/types")
    public List<Map<String, String>> types() {
        return OsmService.PLACE_TYPES.values().stream().map(t -> Map.of("key", t.key(), "label", t.label())).toList();
    }

    @GetMapping("/places/nearby")
    public OsmService.NearbyResult nearby(@RequestParam double lat, @RequestParam double lng, @RequestParam String type,
                                          @RequestParam(defaultValue = "3000") int radius) {
        if (!Geo.valid(lat, lng)) throw ApiException.badRequest("Invalid coordinates");
        return osm.nearby(lat, lng, type, Math.min(Math.max(radius, 200), 10_000));
    }

    @GetMapping("/route")
    public OsmService.RouteResult route(@RequestParam double fromLat, @RequestParam double fromLng,
                                        @RequestParam double toLat, @RequestParam double toLng,
                                        @RequestParam(defaultValue = "driving") String mode) {
        if (!Geo.valid(fromLat, fromLng) || !Geo.valid(toLat, toLng)) throw ApiException.badRequest("Invalid coordinates");
        return osm.route(fromLat, fromLng, toLat, toLng, mode);
    }
}
