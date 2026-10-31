package com.tripzee.trip;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class TripDtos {
    private TripDtos() {}

    public static final String CATEGORY_REGEX = "transport|accommodation|food|tickets|misc";

    public record TripSummary(String id, String title, String origin, String city, LocalDate startDate, LocalDate endDate,
                              int days, int travellers, int budget, String generatedBy, String role, Instant createdAt) {}

    public record ItemDto(String id, int day, int position, String startTime, String endTime, String title, String kind,
                          String destinationId, String destinationSlug, Double lat, Double lng, String notes, int estCost) {}

    public record BudgetLine(String category, int planned, int actual, String basis) {}

    public record BudgetSummary(int budget, int travellers, List<BudgetLine> lines, int plannedTotal, int actualTotal,
                                int remaining, int perPersonPlanned, int perPersonActual) {}

    public record ExpenseDto(String id, String category, int amount, String note, LocalDate spentOn, String userId,
                             String userName, boolean canDelete) {}

    public record RoomRef(String id, String name) {}

    public record TripDetail(String id, String title, String origin, Double originLat, Double originLng, String city,
                             LocalDate startDate, LocalDate endDate, int days, int travellers, int budget, List<String> interests,
                             String transport, String pace, String generatedBy, String notes, String shareToken,
                             boolean canEdit, boolean isOwner, List<ItemDto> items, BudgetSummary budgetSummary,
                             List<ExpenseDto> expenses, List<RoomRef> rooms, Instant updatedAt) {}

    public record UpdateTripRequest(@Size(min = 1, max = 160) String title, @Size(max = 4000) String notes,
                                    LocalDate startDate, LocalDate endDate, @Min(1) @Max(30) Integer travellers,
                                    @Min(0) @Max(10_000_000) Integer budget) {}

    public record ReplaceItemsRequest(@NotNull @Valid @Size(max = 300) List<PlanModels.ItemDraft> items) {}

    public record PlannedLine(@NotBlank @Pattern(regexp = CATEGORY_REGEX) String category, @Min(0) @Max(10_000_000) int planned) {}

    public record BudgetUpdateRequest(@NotNull @Valid @Size(max = 10) List<PlannedLine> lines) {}

    public record ExpenseRequest(@NotBlank @Pattern(regexp = CATEGORY_REGEX) String category,
                                 @Min(1) @Max(10_000_000) int amount, @Size(max = 300) String note, LocalDate spentOn) {}
}
