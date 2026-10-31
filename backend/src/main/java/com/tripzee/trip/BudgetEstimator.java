package com.tripzee.trip;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * Transparent, assumption-based trip cost estimates (INR). Every line carries a "basis" string so
 * the UI can show exactly how it was computed. These are estimates — never presented as current prices.
 */
@Component
public class BudgetEstimator {

    public static final List<String> CATEGORIES = List.of("transport", "accommodation", "food", "tickets", "misc");

    public enum Tier { BUDGET, MID, COMFORT }

    public record Input(Double oneWayKm, String transport, int days, int travellers, int budget, int attractions) {}

    public record Line(String category, int planned, String basis) {}

    public record Estimate(Tier tier, List<Line> lines, int total, int perPerson) {}

    private static final int[] ROOM_PER_NIGHT = {1200, 3000, 7000};
    private static final int[] FOOD_PER_PERSON_DAY = {450, 900, 2000};
    private static final int[] LOCAL_PER_VEHICLE_DAY = {400, 900, 1800};
    static final int TICKET_PLACEHOLDER_PER_PERSON = 100;

    public static Tier tierFor(int budget, int travellers, int days) {
        double perPersonDay = budget / (double) Math.max(1, travellers * days);
        if (perPersonDay < 1500) return Tier.BUDGET;
        if (perPersonDay < 4000) return Tier.MID;
        return Tier.COMFORT;
    }

    public Estimate estimate(Input in) {
        int days = Math.max(1, in.days());
        int people = Math.max(1, in.travellers());
        int nights = days - 1;
        Tier tier = tierFor(in.budget(), people, days);
        int t = tier.ordinal();
        int rooms = (people + 1) / 2;
        int vehicles = (people + 3) / 4;
        List<Line> lines = new ArrayList<>();

        // Transport: intercity round trip + local transport.
        int local = LOCAL_PER_VEHICLE_DAY[t] * vehicles * days;
        String localBasis = String.format(Locale.ROOT, "local cabs/autos ₹%d × %d vehicle(s) × %d day(s)", LOCAL_PER_VEHICLE_DAY[t], vehicles, days);
        if (in.oneWayKm() != null && in.oneWayKm() > 30) {
            double roadKm = in.oneWayKm() * 1.25; // straight-line → typical road distance
            int intercity;
            String basis;
            switch (in.transport() == null ? "train" : in.transport()) {
                case "car" -> {
                    intercity = (int) Math.round(roadKm * 2 * 12 * vehicles);
                    basis = String.format(Locale.ROOT, "~%.0f km each way by road × 2 × ₹12/km × %d vehicle(s)", roadKm, vehicles);
                }
                case "bus" -> {
                    intercity = (int) Math.round(roadKm * 2 * 1.4 * people);
                    basis = String.format(Locale.ROOT, "~%.0f km each way × 2 × ₹1.4/km × %d traveller(s)", roadKm, people);
                }
                case "flight" -> {
                    intercity = (int) Math.round((3500 + in.oneWayKm() * 4) * 2 * people);
                    basis = String.format(Locale.ROOT, "(₹3,500 + ₹4/km × %.0f km) × 2 × %d traveller(s)", in.oneWayKm(), people);
                }
                default -> {
                    intercity = (int) Math.round(roadKm * 2 * 1.0 * people);
                    basis = String.format(Locale.ROOT, "~%.0f km each way × 2 × ₹1/km (AC chair/sleeper avg) × %d traveller(s)", roadKm, people);
                }
            }
            lines.add(new Line("transport", intercity + local, basis + " + " + localBasis));
        } else {
            lines.add(new Line("transport", local, localBasis + " (no intercity leg estimated)"));
        }

        int stay = ROOM_PER_NIGHT[t] * rooms * nights;
        lines.add(new Line("accommodation", stay, nights == 0 ? "day trip — no overnight stay"
                : String.format(Locale.ROOT, "%s tier ₹%d/room/night × %d room(s) × %d night(s)", tier.name().toLowerCase(Locale.ROOT), ROOM_PER_NIGHT[t], rooms, nights)));

        int food = FOOD_PER_PERSON_DAY[t] * people * days;
        lines.add(new Line("food", food, String.format(Locale.ROOT, "₹%d/person/day × %d traveller(s) × %d day(s)", FOOD_PER_PERSON_DAY[t], people, days)));

        int tickets = TICKET_PLACEHOLDER_PER_PERSON * people * Math.max(0, in.attractions());
        lines.add(new Line("tickets", tickets, String.format(Locale.ROOT,
                "placeholder ₹%d/person × %d attraction(s) — entry fees not verified, check each site's official source",
                TICKET_PLACEHOLDER_PER_PERSON, in.attractions())));

        int subtotal = lines.stream().mapToInt(Line::planned).sum();
        int misc = (int) Math.round(subtotal * 0.10);
        lines.add(new Line("misc", misc, "10% buffer for shopping, tips and surprises"));

        int total = subtotal + misc;
        return new Estimate(tier, lines, total, (int) Math.round(total / (double) people));
    }
}
