package com.tripzee.trip;

import com.tripzee.auth.CurrentUser;
import com.tripzee.auth.LoginRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import com.tripzee.trip.PlanModels.PlanDraft;
import com.tripzee.trip.PlanModels.PlanRequest;
import com.tripzee.trip.PlanModels.SaveTripRequest;
import com.tripzee.trip.TripDtos.BudgetSummary;
import com.tripzee.trip.TripDtos.ExpenseDto;
import com.tripzee.trip.TripDtos.TripDetail;
import com.tripzee.trip.TripDtos.TripSummary;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TripController {
    private final PlannerService planner;
    private final TripService trips;
    private final LoginRateLimiter limiter;

    /** Generates a draft itinerary without saving it (available to guests). */
    @PostMapping("/trips/plan")
    public PlanDraft plan(@Valid @RequestBody PlanRequest req, HttpServletRequest http) {
        limiter.check("plan:" + http.getRemoteAddr(), 30, 10 * 60_000L);
        return planner.plan(req);
    }

    @PostMapping("/trips")
    @ResponseStatus(HttpStatus.CREATED)
    public TripDetail create(@Valid @RequestBody SaveTripRequest body) {
        return trips.create(body.request(), body.items(), body.generatedBy(), CurrentUser.require());
    }

    @GetMapping("/trips")
    public List<TripSummary> mine() {
        return trips.mine(CurrentUser.require());
    }

    @GetMapping("/trips/{id}")
    public TripDetail get(@PathVariable String id) {
        return trips.get(id, CurrentUser.require());
    }

    @PatchMapping("/trips/{id}")
    public TripDetail update(@PathVariable String id, @Valid @RequestBody TripDtos.UpdateTripRequest body) {
        return trips.update(id, body, CurrentUser.require());
    }

    @DeleteMapping("/trips/{id}")
    public Map<String, Object> delete(@PathVariable String id) {
        trips.delete(id, CurrentUser.require());
        return Map.of("ok", true);
    }

    @PutMapping("/trips/{id}/items")
    public TripDetail replaceItems(@PathVariable String id, @Valid @RequestBody TripDtos.ReplaceItemsRequest body) {
        return trips.replaceItems(id, body.items(), CurrentUser.require());
    }

    @PostMapping("/trips/{id}/regenerate")
    public TripDetail regenerate(@PathVariable String id) {
        return trips.regenerate(id, CurrentUser.require());
    }

    @PostMapping("/trips/{id}/share")
    public Map<String, Object> share(@PathVariable String id) {
        Map<String, Object> out = new HashMap<>();
        out.put("shareToken", trips.share(id, true, CurrentUser.require()));
        return out;
    }

    @DeleteMapping("/trips/{id}/share")
    public Map<String, Object> unshare(@PathVariable String id) {
        trips.share(id, false, CurrentUser.require());
        return Map.of("ok", true);
    }

    @PutMapping("/trips/{id}/budget")
    public BudgetSummary updateBudget(@PathVariable String id, @Valid @RequestBody TripDtos.BudgetUpdateRequest body) {
        return trips.updatePlanned(id, body.lines(), CurrentUser.require());
    }

    @PostMapping("/trips/{id}/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseDto addExpense(@PathVariable String id, @Valid @RequestBody TripDtos.ExpenseRequest body) {
        return trips.addExpense(id, body, CurrentUser.require());
    }

    @DeleteMapping("/trips/{id}/expenses/{expenseId}")
    public Map<String, Object> deleteExpense(@PathVariable String id, @PathVariable String expenseId) {
        trips.deleteExpense(id, expenseId, CurrentUser.require());
        return Map.of("ok", true);
    }

    @GetMapping("/shared/{token}")
    public TripDetail shared(@PathVariable String token) {
        return trips.shared(token);
    }
}
