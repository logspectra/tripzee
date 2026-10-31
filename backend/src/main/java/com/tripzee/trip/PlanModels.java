package com.tripzee.trip;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public final class PlanModels {
    private PlanModels() {}

    public static final String INTEREST_REGEX = "history|nature|spirituality|shopping|adventure|food|architecture|culture";

    public record PlanRequest(
            @NotBlank @Size(max = 160) String origin,
            Double originLat,
            Double originLng,
            @NotBlank @Size(max = 80) String city,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @Min(1) @Max(30) int travellers,
            @Min(500) @Max(10_000_000) int budget,
            @Size(max = 8) List<@Pattern(regexp = INTEREST_REGEX) String> interests,
            @NotBlank @Pattern(regexp = "car|train|bus|flight") String transport,
            @NotBlank @Pattern(regexp = "relaxed|moderate|packed") String pace,
            @Size(max = 160) String title) {}

    public record ItemDraft(
            @Min(1) @Max(30) int day,
            int position,
            @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$") String startTime,
            @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$") String endTime,
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Pattern(regexp = "attraction|food|travel|stay|other") String kind,
            String destinationId,
            String destinationSlug,
            Double lat,
            Double lng,
            @Size(max = 2000) String notes,
            @Min(0) @Max(10_000_000) int estCost) {}

    public record PlanDraft(
            String title,
            String city,
            double cityLat,
            double cityLng,
            Double originLat,
            Double originLng,
            Double oneWayKm,
            LocalDate startDate,
            LocalDate endDate,
            int days,
            String generatedBy,
            List<ItemDraft> items,
            BudgetEstimator.Estimate budget,
            List<String> warnings) {}

    public record SaveTripRequest(@NotNull @Valid PlanRequest request, @Valid @Size(max = 300) List<ItemDraft> items, String generatedBy) {}
}
