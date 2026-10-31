package com.tripzee.trip;

import static org.assertj.core.api.Assertions.assertThat;

import com.tripzee.trip.BudgetEstimator.Estimate;
import com.tripzee.trip.BudgetEstimator.Input;
import com.tripzee.trip.BudgetEstimator.Line;
import com.tripzee.trip.BudgetEstimator.Tier;
import org.junit.jupiter.api.Test;

class BudgetEstimatorTest {
    private final BudgetEstimator estimator = new BudgetEstimator();

    private static int line(Estimate e, String category) {
        return e.lines().stream().filter(l -> l.category().equals(category)).mapToInt(Line::planned).findFirst().orElseThrow();
    }

    @Test
    void tierFollowsBudgetPerPersonPerDay() {
        assertThat(BudgetEstimator.tierFor(2_000, 2, 1)).isEqualTo(Tier.BUDGET);   // 1000/person/day
        assertThat(BudgetEstimator.tierFor(12_000, 2, 2)).isEqualTo(Tier.MID);     // 3000
        assertThat(BudgetEstimator.tierFor(50_000, 2, 2)).isEqualTo(Tier.COMFORT); // 12500
    }

    @Test
    void dayTripHasNoAccommodationAndNoIntercityWhenOriginUnknown() {
        Estimate e = estimator.estimate(new Input(null, "train", 1, 2, 2_000, 2));
        assertThat(line(e, "accommodation")).isZero();
        assertThat(line(e, "transport")).isEqualTo(400); // budget tier local transport, 1 vehicle, 1 day
        assertThat(e.lines()).extracting(Line::category).containsExactly("transport", "accommodation", "food", "tickets", "misc");
    }

    @Test
    void totalsIncludeTenPercentBufferAndPerPersonSplit() {
        Estimate e = estimator.estimate(new Input(200.0, "train", 3, 3, 30_000, 5));
        int subtotal = e.lines().stream().filter(l -> !l.category().equals("misc")).mapToInt(Line::planned).sum();
        assertThat(line(e, "misc")).isEqualTo(Math.round(subtotal * 0.10f));
        assertThat(e.total()).isEqualTo(subtotal + line(e, "misc"));
        assertThat(e.perPerson()).isEqualTo(Math.round(e.total() / 3f));
        // 3 travellers → 2 rooms × 2 nights at MID (₹3000)
        assertThat(line(e, "accommodation")).isEqualTo(12_000);
    }

    @Test
    void carCostScalesWithVehiclesNotPeople() {
        // ₹3000/person/day → MID tier (local transport ₹900 per vehicle per day)
        Estimate four = estimator.estimate(new Input(100.0, "car", 1, 4, 12_000, 0));
        Estimate five = estimator.estimate(new Input(100.0, "car", 1, 5, 15_000, 0));
        // 100 km × 1.25 road factor × 2 ways × ₹12/km = 3000 per vehicle, + local transport
        assertThat(line(four, "transport")).isEqualTo(3000 + 900);
        assertThat(line(five, "transport")).isEqualTo(6000 + 1800);
    }

    @Test
    void ticketsAreAPlainlyLabelledPlaceholder() {
        Estimate e = estimator.estimate(new Input(null, "bus", 2, 2, 10_000, 3));
        Line tickets = e.lines().stream().filter(l -> l.category().equals("tickets")).findFirst().orElseThrow();
        assertThat(tickets.planned()).isEqualTo(BudgetEstimator.TICKET_PLACEHOLDER_PER_PERSON * 2 * 3);
        assertThat(tickets.basis()).contains("not verified");
    }
}
