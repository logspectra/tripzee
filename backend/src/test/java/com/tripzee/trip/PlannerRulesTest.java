package com.tripzee.trip;

import static org.assertj.core.api.Assertions.assertThat;

import com.tripzee.domain.Destination;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlannerRulesTest {

    private static Destination place(String name, double lat, double lng) {
        Destination d = new Destination();
        d.setName(name);
        d.setLat(lat);
        d.setLng(lng);
        return d;
    }

    @Test
    void formatsTimesAndDurations() {
        assertThat(PlannerService.hhmm(9 * 60 + 5)).isEqualTo("09:05");
        assertThat(PlannerService.hhmm(30 * 60)).isEqualTo("23:59");
        assertThat(PlannerService.duration(45)).isEqualTo("45 min");
        assertThat(PlannerService.duration(120)).isEqualTo("2 h");
        assertThat(PlannerService.duration(135)).isEqualTo("2 h 15 min");
    }

    @Test
    void paceControlsStopsPerDay() {
        assertThat(PlannerService.slotsPerDay("relaxed")).isEqualTo(2);
        assertThat(PlannerService.slotsPerDay("moderate")).isEqualTo(3);
        assertThat(PlannerService.slotsPerDay("packed")).isEqualTo(4);
    }

    @Test
    void nearestNeighbourVisitsClosestPlaceNext() {
        Destination far = place("far", 27.30, 78.30);
        Destination near = place("near", 27.17, 78.04);
        Destination mid = place("mid", 27.20, 78.10);
        List<Destination> order = PlannerService.nearestNeighbourOrder(List.of(far, mid, near), 27.16, 78.03);
        assertThat(order).extracting(Destination::getName).containsExactly("near", "mid", "far");
    }

    @Test
    void flightsIncludeAirportOverhead() {
        assertThat(PlannerService.intercityMinutes(500, "flight")).isGreaterThan(150);
        assertThat(PlannerService.intercityMinutes(200, "car")).isEqualTo(300); // 250 road km at 50 km/h
    }

    private static int mins(String hhmm) {
        return Integer.parseInt(hhmm.substring(0, 2)) * 60 + Integer.parseInt(hhmm.substring(3));
    }

    @Test
    void longJourneyHasNoMealsBeforeArrivalAndKeepsLastMorningFree() {
        PlannerService planner = new PlannerService(null, null, null, null, null, null);
        var req = new PlanModels.PlanRequest("Delhi", null, null, "Varanasi", java.time.LocalDate.of(2026, 12, 10),
                java.time.LocalDate.of(2026, 12, 12), 3, 30_000, List.of("history"), "train", "moderate", null);
        List<Destination> places = new java.util.ArrayList<>();
        for (int i = 0; i < 6; i++) places.add(place("p" + i, 25.30 + i * 0.01, 83.00 + i * 0.01));
        List<String> warnings = new java.util.ArrayList<>();

        var items = planner.ruleItinerary(req, 3, places, new java.util.HashMap<>(), 25.31, 83.01, new double[]{28.61, 77.21}, 680.0, warnings);

        var day1 = items.stream().filter(i -> i.day() == 1).toList();
        assertThat(day1.get(0).kind()).isEqualTo("travel");
        int arrival = day1.get(0).endTime() == null ? 24 * 60 : mins(day1.get(0).endTime());
        assertThat(day1.stream().filter(i -> !"travel".equals(i.kind())))
                .allSatisfy(i -> assertThat(mins(i.startTime())).isGreaterThanOrEqualTo(arrival));

        var day3 = items.stream().filter(i -> i.day() == 3).toList();
        assertThat(day3.get(day3.size() - 1).kind()).isEqualTo("travel");
        assertThat(day3).anyMatch(i -> "attraction".equals(i.kind()));
        assertThat(warnings).anyMatch(w -> w.contains("overnight"));
    }

    @Test
    void scorePrefersInterestMatchesAndCloserPlaces() {
        Destination fort = place("fort", 0, 0);
        fort.setInterests("history,architecture");
        Destination park = place("park", 0, 0);
        park.setInterests("nature");
        List<String> interests = List.of("history");
        assertThat(PlannerService.score(fort, interests, null, 2)).isGreaterThan(PlannerService.score(park, interests, null, 2));
        assertThat(PlannerService.score(fort, interests, null, 2)).isGreaterThan(PlannerService.score(fort, interests, null, 90));
    }
}
