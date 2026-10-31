package com.tripzee.trip;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripzee.common.ApiException;
import com.tripzee.common.Geo;
import com.tripzee.destination.DestinationDtos.RatingStats;
import com.tripzee.destination.DestinationService;
import com.tripzee.domain.Destination;
import com.tripzee.places.OsmService;
import com.tripzee.repo.DestinationRepository;
import com.tripzee.trip.PlanModels.ItemDraft;
import com.tripzee.trip.PlanModels.PlanDraft;
import com.tripzee.trip.PlanModels.PlanRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Builds day-by-day itineraries. Uses the configured LLM when available (constrained to the
 * curated catalogue), otherwise a deterministic rule-based planner. Costs always come from
 * {@link BudgetEstimator}, never from the LLM.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlannerService {
    public static final int MAX_DAYS = 14;
    static final int DAY_START = 9 * 60;
    static final int DAY_END = 19 * 60;
    static final int DEPART = 7 * 60;
    static final int LAST_MINUTE = 23 * 60 + 59;
    static final double CITY_SPEED_KMH = 25;

    private final DestinationRepository destinations;
    private final DestinationService destinationService;
    private final BudgetEstimator estimator;
    private final OsmService osm;
    private final LlmClient llm;
    private final ObjectMapper mapper;

    /** Well-known origin coordinates so planning works without a geocoding call. */
    static final Map<String, double[]> KNOWN_ORIGINS = Map.ofEntries(
            Map.entry("delhi", new double[]{28.6139, 77.2090}), Map.entry("new delhi", new double[]{28.6139, 77.2090}),
            Map.entry("noida", new double[]{28.5355, 77.3910}), Map.entry("gurgaon", new double[]{28.4595, 77.0266}),
            Map.entry("gurugram", new double[]{28.4595, 77.0266}), Map.entry("mumbai", new double[]{19.0760, 72.8777}),
            Map.entry("bengaluru", new double[]{12.9716, 77.5946}), Map.entry("bangalore", new double[]{12.9716, 77.5946}),
            Map.entry("kolkata", new double[]{22.5726, 88.3639}), Map.entry("chennai", new double[]{13.0827, 80.2707}),
            Map.entry("hyderabad", new double[]{17.3850, 78.4867}), Map.entry("jaipur", new double[]{26.9124, 75.7873}),
            Map.entry("kanpur", new double[]{26.4499, 80.3319}), Map.entry("patna", new double[]{25.5941, 85.1376}),
            Map.entry("bhopal", new double[]{23.2599, 77.4126}), Map.entry("pune", new double[]{18.5204, 73.8567}),
            Map.entry("ahmedabad", new double[]{23.0225, 72.5714}), Map.entry("dehradun", new double[]{30.3165, 78.0322}),
            Map.entry("chandigarh", new double[]{30.7333, 76.7794}), Map.entry("meerut", new double[]{28.9845, 77.7064}),
            Map.entry("ghaziabad", new double[]{28.6692, 77.4538}), Map.entry("bareilly", new double[]{28.3670, 79.4304}));

    public PlanDraft plan(PlanRequest req) {
        int days = (int) (req.endDate().toEpochDay() - req.startDate().toEpochDay()) + 1;
        if (days < 1) throw ApiException.badRequest("End date must be on or after the start date");
        if (days > MAX_DAYS) throw ApiException.badRequest("Trips can be planned for up to " + MAX_DAYS + " days");

        List<Destination> inCity = destinations.findByCityIgnoreCaseAndPublishedTrue(req.city().trim());
        if (inCity.isEmpty()) throw ApiException.badRequest("We don't have curated places for \"" + req.city() + "\" yet. Pick a city from the list.");
        double cLat = inCity.stream().mapToDouble(Destination::getLat).average().orElseThrow();
        double cLng = inCity.stream().mapToDouble(Destination::getLng).average().orElseThrow();

        List<String> warnings = new ArrayList<>();
        double[] origin = resolveOrigin(req, warnings);
        Double oneWayKm = origin == null ? null : Geo.round1(Geo.haversineKm(origin[0], origin[1], cLat, cLng));

        List<Destination> candidates = destinations.findAllById(
                destinationService.near(cLat, cLng, 120, null).stream().map(c -> c.id()).toList());
        Map<String, RatingStats> ratings = destinationService.ratings(candidates.stream().map(Destination::getId).toList());

        List<ItemDraft> items = null;
        String generatedBy = "rules";
        if (llm.enabled()) {
            try {
                items = llmItinerary(req, days, candidates, origin, oneWayKm);
                generatedBy = "llm";
            } catch (Exception e) {
                log.warn("AI planner failed, using rule-based planner: {}", e.getMessage());
                warnings.add("The AI planner was unavailable, so this itinerary was built by Tripzee's rule-based planner.");
            }
        }
        if (items == null) items = ruleItinerary(req, days, candidates, ratings, cLat, cLng, origin, oneWayKm, warnings);

        long attractions = items.stream().filter(i -> "attraction".equals(i.kind())).count();
        BudgetEstimator.Estimate estimate = estimator.estimate(new BudgetEstimator.Input(oneWayKm, req.transport(), days,
                req.travellers(), req.budget(), (int) attractions));
        if (estimate.total() > req.budget()) {
            warnings.add(String.format(Locale.ROOT, "Estimated cost (₹%,d) is above your budget (₹%,d). Consider fewer nights, a cheaper stay tier or train/bus travel.",
                    estimate.total(), req.budget()));
        }
        String title = req.title() != null && !req.title().isBlank() ? req.title().trim()
                : String.format(Locale.ROOT, "%d-day %s trip", days, capitalize(req.city().trim()));
        return new PlanDraft(title, inCity.get(0).getCity(), cLat, cLng, origin == null ? null : origin[0], origin == null ? null : origin[1],
                oneWayKm, req.startDate(), req.endDate(), days, generatedBy, items, estimate, warnings);
    }

    private double[] resolveOrigin(PlanRequest req, List<String> warnings) {
        if (Geo.valid(req.originLat(), req.originLng())) return new double[]{req.originLat(), req.originLng()};
        String key = req.origin().trim().toLowerCase(Locale.ROOT);
        if (KNOWN_ORIGINS.containsKey(key)) return KNOWN_ORIGINS.get(key);
        var local = destinations.findByCityIgnoreCaseAndPublishedTrue(req.origin().trim());
        if (!local.isEmpty()) return new double[]{local.get(0).getLat(), local.get(0).getLng()};
        try {
            var hits = osm.geocode(req.origin().trim(), 1);
            if (!hits.isEmpty()) return new double[]{hits.get(0).lat(), hits.get(0).lng()};
        } catch (Exception e) {
            log.debug("Origin geocode failed: {}", e.getMessage());
        }
        warnings.add("We couldn't locate \"" + req.origin() + "\", so intercity travel time and cost are not included.");
        return null;
    }

    // ---------------- Rule-based planner ----------------

    static int slotsPerDay(String pace) {
        return switch (pace) {
            case "relaxed" -> 2;
            case "packed" -> 4;
            default -> 3;
        };
    }

    static double paceFactor(String pace) {
        return switch (pace) {
            case "relaxed" -> 1.2;
            case "packed" -> 0.85;
            default -> 1.0;
        };
    }

    static double score(Destination d, List<String> interests, RatingStats r, double distFromCenterKm) {
        long overlap = d.interestList().stream().filter(interests::contains).count();
        double s = overlap * 3.0;
        if (r != null && r.average() != null) s += (r.average() - 3) * 0.5;
        s -= distFromCenterKm / 30.0; // prefer in-city places; day trips need strong interest match
        return s;
    }

    List<ItemDraft> ruleItinerary(PlanRequest req, int days, List<Destination> candidates, Map<String, RatingStats> ratings,
                                  double cLat, double cLng, double[] origin, Double oneWayKm, List<String> warnings) {
        List<String> interests = req.interests() == null ? List.of() : req.interests();
        int slots = slotsPerDay(req.pace());
        double factor = paceFactor(req.pace());

        // Arrival on day 1 consumes part of the day; departure on the last day always leaves a morning free.
        int travelMin = origin != null && oneWayKm != null && oneWayKm > 30 ? intercityMinutes(oneWayKm, req.transport()) : 0;
        int arrival = DEPART + travelMin;
        int day1Start = travelMin == 0 ? DAY_START : Math.max(DAY_START, arrival + 60);
        int lastDayEnd = travelMin == 0 ? DAY_END : Math.max(13 * 60, DAY_END - travelMin - 60);
        if (travelMin > 10 * 60) {
            warnings.add(String.format(Locale.ROOT, "Getting from %s to %s takes roughly %s by %s — consider an overnight train/bus or a flight. Day 1 is treated as a travel day.",
                    req.origin(), capitalize(req.city()), duration(travelMin), req.transport()));
        }

        List<Destination> ranked = candidates.stream()
                .sorted(Comparator.comparingDouble((Destination d) -> -score(d, interests, ratings.get(d.getId()),
                        Geo.haversineKm(cLat, cLng, d.getLat(), d.getLng()))))
                .collect(Collectors.toCollection(ArrayList::new));
        int wanted = Math.min(ranked.size(), days * slots);
        List<Destination> picks = nearestNeighbourOrder(ranked.subList(0, wanted), cLat, cLng);
        if (picks.size() < days * slots) {
            warnings.add("Tripzee has " + picks.size() + " curated places around " + capitalize(req.city())
                    + " — some days are lighter so you can explore on your own.");
        }

        List<ItemDraft> items = new ArrayList<>();
        LinkedList<Destination> queue = new LinkedList<>(picks);
        int foodPerPersonDay = switch (BudgetEstimator.tierFor(req.budget(), req.travellers(), days)) {
            case BUDGET -> 450;
            case MID -> 900;
            case COMFORT -> 2000;
        };
        for (int day = 1; day <= days; day++) {
            int pos = 0;
            int t = day == 1 ? day1Start : DAY_START;
            int end = day == days ? lastDayEnd : DAY_END;
            if (day == 1 && travelMin > 0) {
                boolean nextDay = arrival > LAST_MINUTE;
                items.add(new ItemDraft(day, pos++, hhmm(DEPART), nextDay ? null : hhmm(arrival),
                        "Travel from " + req.origin() + " to " + capitalize(req.city()), "travel", null, null, null, null,
                        String.format(Locale.ROOT, "~%.0f km by %s, roughly %s%s. Check live schedules/traffic before leaving.",
                                oneWayKm * 1.25, req.transport(), duration(travelMin), nextDay ? " (arrives the next day)" : ""), 0));
            }
            if (day == 1 && days > 1 && arrival + 15 <= LAST_MINUTE - 30) {
                int checkIn = travelMin == 0 ? t - 45 : arrival + 15;
                items.add(item(day, pos++, checkIn, checkIn + 30, "Check in to your stay", "stay", null, cLat, cLng,
                        "Browse real hotels near the city centre in Tripzee's Hotels & Services tab.", 0));
            }
            boolean lunch = false;
            double prevLat = cLat, prevLng = cLng;
            int placed = 0;
            while (!queue.isEmpty() && placed < slots) {
                Destination d = queue.peekFirst();
                int travel = Math.max(10, (int) Math.round(Geo.haversineKm(prevLat, prevLng, d.getLat(), d.getLng()) * 1.3 / CITY_SPEED_KMH * 60));
                int visit = (int) Math.round(d.getVisitMinutes() * factor);
                boolean needLunch = !lunch && t < 15 * 60 && (t >= 12 * 60 || (t >= 11 * 60 + 30 && t + travel + visit > 14 * 60));
                if ((needLunch ? t + 60 : t) + travel + visit > end) break;
                if (needLunch) {
                    items.add(item(day, pos++, t, t + 60, "Lunch break", "food", null, prevLat, prevLng,
                            "Find restaurants near this point in the Hotels & Services tab.", foodPerPersonDay * 35 / 100 * req.travellers()));
                    t += 60;
                    lunch = true;
                }
                t += travel;
                items.add(item(day, pos++, t, t + visit, d.getName(), "attraction", d, d.getLat(), d.getLng(),
                        String.format(Locale.ROOT, "~%d min travel from previous stop. Typical visit %s. Check opening hours and entry fee on the place page — they are only shown when verified.",
                                travel, duration(visit)), 0));
                t += visit;
                prevLat = d.getLat();
                prevLng = d.getLng();
                queue.pollFirst();
                placed++;
            }
            boolean onTripGround = day > 1 || travelMin == 0 || arrival < 14 * 60;
            if (!lunch && onTripGround && t <= 14 * 60 && day < days) {
                items.add(item(day, pos++, Math.max(t, 13 * 60), Math.max(t, 13 * 60) + 60, "Lunch break", "food", null, prevLat, prevLng,
                        "Find restaurants nearby in the Hotels & Services tab.", foodPerPersonDay * 35 / 100 * req.travellers()));
            }
            if (day == days && travelMin > 0) {
                int depart = Math.min(Math.max(t + 30, 14 * 60), 22 * 60);
                boolean nextDay = depart + travelMin > LAST_MINUTE;
                items.add(new ItemDraft(day, pos++, hhmm(depart), nextDay ? null : hhmm(depart + travelMin), "Return to " + req.origin(),
                        "travel", null, null, null, null,
                        "Roughly " + duration(travelMin) + " by " + req.transport() + (nextDay ? " — arrives the next day." : "."), 0));
            } else {
                int dinner = Math.max(19 * 60 + 30, (day == 1 && travelMin > 0 ? arrival : t) + 45);
                if (dinner <= 21 * 60 + 30) {
                    items.add(item(day, pos++, dinner, dinner + 90, "Dinner", "food", null, prevLat, prevLng,
                            "Try local food near your stay — see Restaurants in the Hotels & Services tab.", foodPerPersonDay * 45 / 100 * req.travellers()));
                }
            }
        }
        return items;
    }

    static int intercityMinutes(double oneWayKm, String transport) {
        double road = oneWayKm * 1.25;
        return (int) Math.round(switch (transport) {
            case "flight" -> 150 + oneWayKm / 650 * 60; // incl. airport time
            case "car" -> road / 50 * 60;
            case "bus" -> road / 40 * 60;
            default -> road / 55 * 60;
        });
    }

    static List<Destination> nearestNeighbourOrder(List<Destination> picks, double lat, double lng) {
        List<Destination> left = new ArrayList<>(picks);
        List<Destination> out = new ArrayList<>();
        double cLat = lat, cLng = lng;
        while (!left.isEmpty()) {
            final double fLat = cLat, fLng = cLng;
            Destination next = left.stream().min(Comparator.comparingDouble(d -> Geo.haversineKm(fLat, fLng, d.getLat(), d.getLng()))).orElseThrow();
            out.add(next);
            left.remove(next);
            cLat = next.getLat();
            cLng = next.getLng();
        }
        return out;
    }

    private static ItemDraft item(int day, int pos, int start, int end, String title, String kind, Destination d,
                                  Double lat, Double lng, String notes, int cost) {
        return new ItemDraft(day, pos, hhmm(start), hhmm(end), title, kind, d == null ? null : d.getId(),
                d == null ? null : d.getSlug(), lat, lng, notes, cost);
    }

    static String hhmm(int minutes) {
        int m = Math.max(0, Math.min(minutes, 23 * 60 + 59));
        return String.format(Locale.ROOT, "%02d:%02d", m / 60, m % 60);
    }

    static String duration(int minutes) {
        int h = minutes / 60, m = minutes % 60;
        return h == 0 ? m + " min" : m == 0 ? h + " h" : h + " h " + m + " min";
    }

    static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    // ---------------- LLM planner ----------------

    private List<ItemDraft> llmItinerary(PlanRequest req, int days, List<Destination> candidates, double[] origin, Double oneWayKm) throws Exception {
        String catalogue = candidates.stream().limit(40)
                .map(d -> String.format(Locale.ROOT, "- slug=%s | %s | %s | typical visit %d min | interests: %s",
                        d.getSlug(), d.getName(), d.getCity(), d.getVisitMinutes(), d.getInterests()))
                .collect(Collectors.joining("\n"));
        String system = """
                You are Tripzee's trip planner for India. Build a realistic day-by-day itinerary.
                Rules: use ONLY attractions from the catalogue (reference them by slug). Do not invent prices, opening
                hours, ticket fees, hotel names or restaurant names. Food stops are generic ("Lunch near <place>").
                Respond with JSON only: {"days":[{"day":1,"items":[{"start":"HH:mm","end":"HH:mm","title":"...",
                "kind":"attraction|food|travel|stay|other","slug":"<catalogue slug or null>","notes":"..."}]}]}""";
        String user = String.format(Locale.ROOT, """
                Origin: %s%s
                Destination city: %s
                Days: %d (start %s)
                Travellers: %d, total budget INR %d
                Interests: %s
                Transport: %s, pace: %s
                Catalogue:
                %s""", req.origin(), oneWayKm == null ? "" : String.format(Locale.ROOT, " (~%.0f km away)", oneWayKm),
                req.city(), days, req.startDate(), req.travellers(), req.budget(),
                req.interests() == null ? "any" : String.join(", ", req.interests()), req.transport(), req.pace(), catalogue);

        String content = llm.chat(List.of(new LlmClient.Message("system", system), new LlmClient.Message("user", user)), true);
        JsonNode root = mapper.readTree(content);
        Map<String, Destination> bySlug = new HashMap<>();
        candidates.forEach(d -> bySlug.put(d.getSlug(), d));
        List<ItemDraft> items = new ArrayList<>();
        for (JsonNode dayNode : root.path("days")) {
            int day = dayNode.path("day").asInt();
            if (day < 1 || day > days) continue;
            int pos = 0;
            for (JsonNode it : dayNode.path("items")) {
                String kind = it.path("kind").asText("other");
                if (!kind.matches("attraction|food|travel|stay|other")) kind = "other";
                Destination d = bySlug.get(it.path("slug").asText(""));
                if ("attraction".equals(kind) && d == null) continue; // drop anything outside the catalogue
                String title = d != null ? d.getName() : truncate(it.path("title").asText("Free time"), 200);
                items.add(new ItemDraft(day, pos++, validTime(it.path("start").asText(null)), validTime(it.path("end").asText(null)),
                        title, kind, d == null ? null : d.getId(), d == null ? null : d.getSlug(),
                        d == null ? null : d.getLat(), d == null ? null : d.getLng(), truncate(it.path("notes").asText(""), 2000), 0));
            }
        }
        if (items.stream().noneMatch(i -> "attraction".equals(i.kind()))) throw new IllegalStateException("AI itinerary had no valid attractions");
        return items;
    }

    private static String validTime(String s) {
        return s != null && s.matches("^([01]\\d|2[0-3]):[0-5]\\d$") ? s : null;
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
