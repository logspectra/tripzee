package com.tripzee.trip;

import com.tripzee.auth.AppUser;
import com.tripzee.common.ApiException;
import com.tripzee.domain.BudgetCategory;
import com.tripzee.domain.Destination;
import com.tripzee.domain.Expense;
import com.tripzee.domain.ItineraryItem;
import com.tripzee.domain.Trip;
import com.tripzee.domain.TravelRoom;
import com.tripzee.repo.BudgetCategoryRepository;
import com.tripzee.repo.DestinationRepository;
import com.tripzee.repo.ExpenseRepository;
import com.tripzee.repo.ItineraryItemRepository;
import com.tripzee.repo.RoomMemberRepository;
import com.tripzee.repo.TravelRoomRepository;
import com.tripzee.repo.TripRepository;
import com.tripzee.repo.UserRepository;
import com.tripzee.trip.PlanModels.ItemDraft;
import com.tripzee.trip.PlanModels.PlanDraft;
import com.tripzee.trip.PlanModels.PlanRequest;
import com.tripzee.trip.TripDtos.BudgetLine;
import com.tripzee.trip.TripDtos.BudgetSummary;
import com.tripzee.trip.TripDtos.ExpenseDto;
import com.tripzee.trip.TripDtos.ItemDto;
import com.tripzee.trip.TripDtos.RoomRef;
import com.tripzee.trip.TripDtos.TripDetail;
import com.tripzee.trip.TripDtos.TripSummary;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TripService {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final TripRepository trips;
    private final ItineraryItemRepository items;
    private final BudgetCategoryRepository budgets;
    private final ExpenseRepository expenses;
    private final DestinationRepository destinations;
    private final TravelRoomRepository rooms;
    private final RoomMemberRepository members;
    private final UserRepository users;
    private final PlannerService planner;
    private final BudgetEstimator estimator;

    // ---------- access ----------

    public boolean isMember(Trip t, String userId) {
        return rooms.findByTripId(t.getId()).stream().anyMatch(r -> members.existsByRoomIdAndUserId(r.getId(), userId));
    }

    public Trip requireView(String id, AppUser user) {
        Trip t = trips.findById(id).orElseThrow(() -> ApiException.notFound("Trip"));
        if (t.getOwnerId().equals(user.id()) || isMember(t, user.id())) return t;
        throw ApiException.notFound("Trip"); // don't reveal existence
    }

    public Trip requireOwner(String id, AppUser user) {
        Trip t = requireView(id, user);
        if (!t.getOwnerId().equals(user.id())) throw ApiException.forbidden();
        return t;
    }

    // ---------- create / update ----------

    @Transactional
    public TripDetail create(PlanRequest req, List<ItemDraft> drafts, String generatedBy, AppUser user) {
        PlanDraft draft = planner.plan(req);
        Trip t = new Trip();
        t.setOwnerId(user.id());
        t.setTitle(draft.title());
        t.setOrigin(req.origin().trim());
        t.setOriginLat(draft.originLat());
        t.setOriginLng(draft.originLng());
        t.setCity(draft.city());
        t.setStartDate(req.startDate());
        t.setEndDate(req.endDate());
        t.setTravellers(req.travellers());
        t.setBudget(req.budget());
        t.setInterests(req.interests() == null ? "" : String.join(",", req.interests()));
        t.setTransport(req.transport());
        t.setPace(req.pace());
        boolean custom = drafts != null && !drafts.isEmpty();
        t.setGeneratedBy(custom ? (generatedBy != null && generatedBy.matches("rules|llm|manual") ? generatedBy : "manual") : draft.generatedBy());
        trips.save(t);
        saveItems(t, custom ? drafts : draft.items());
        saveEstimate(t, custom ? drafts : draft.items(), draft.oneWayKm());
        return detail(t, user);
    }

    @Transactional
    public TripDetail update(String id, TripDtos.UpdateTripRequest req, AppUser user) {
        Trip t = requireOwner(id, user);
        if (req.title() != null) t.setTitle(req.title().trim());
        if (req.notes() != null) t.setNotes(req.notes());
        if (req.startDate() != null) t.setStartDate(req.startDate());
        if (req.endDate() != null) t.setEndDate(req.endDate());
        if (t.getEndDate().isBefore(t.getStartDate())) throw ApiException.badRequest("End date must be on or after the start date");
        if (t.days() > PlannerService.MAX_DAYS) throw ApiException.badRequest("Trips can be up to " + PlannerService.MAX_DAYS + " days");
        if (req.travellers() != null) t.setTravellers(req.travellers());
        if (req.budget() != null) t.setBudget(req.budget());
        trips.save(t);
        return detail(t, user);
    }

    @Transactional
    public TripDetail replaceItems(String id, List<ItemDraft> drafts, AppUser user) {
        Trip t = requireOwner(id, user);
        for (ItemDraft d : drafts) {
            if (d.day() > t.days()) throw ApiException.badRequest("Item \"" + d.title() + "\" is on day " + d.day() + " but the trip has " + t.days() + " day(s)");
        }
        items.deleteByTripId(t.getId());
        saveItems(t, drafts);
        if ("rules".equals(t.getGeneratedBy()) || "llm".equals(t.getGeneratedBy())) t.setGeneratedBy(t.getGeneratedBy() + "+edited");
        trips.save(t);
        return detail(t, user);
    }

    @Transactional
    public TripDetail regenerate(String id, AppUser user) {
        Trip t = requireOwner(id, user);
        PlanRequest req = new PlanRequest(t.getOrigin(), t.getOriginLat(), t.getOriginLng(), t.getCity(), t.getStartDate(), t.getEndDate(),
                t.getTravellers(), t.getBudget(), t.getInterests().isBlank() ? List.of() : Arrays.asList(t.getInterests().split(",")),
                t.getTransport(), t.getPace(), t.getTitle());
        PlanDraft draft = planner.plan(req);
        items.deleteByTripId(t.getId());
        budgets.deleteByTripId(t.getId());
        items.flush();
        saveItems(t, draft.items());
        saveEstimate(t, draft.items(), draft.oneWayKm());
        t.setGeneratedBy(draft.generatedBy());
        trips.save(t);
        return detail(t, user);
    }

    @Transactional
    public void delete(String id, AppUser user) {
        trips.delete(requireOwner(id, user));
    }

    @Transactional
    public String share(String id, boolean enable, AppUser user) {
        Trip t = requireOwner(id, user);
        if (enable && t.getShareToken() == null) {
            byte[] b = new byte[18];
            RANDOM.nextBytes(b);
            t.setShareToken(Base64.getUrlEncoder().withoutPadding().encodeToString(b));
        } else if (!enable) {
            t.setShareToken(null);
        }
        trips.save(t);
        return t.getShareToken();
    }

    private void saveItems(Trip t, List<ItemDraft> drafts) {
        Set<String> validIds = destinations.findAllById(drafts.stream().map(ItemDraft::destinationId).filter(x -> x != null).toList())
                .stream().map(Destination::getId).collect(Collectors.toSet());
        Map<Integer, Integer> positions = new HashMap<>();
        drafts.stream()
                .sorted((a, b) -> a.day() != b.day() ? Integer.compare(a.day(), b.day()) : Integer.compare(a.position(), b.position()))
                .forEach(d -> {
                    ItineraryItem i = new ItineraryItem();
                    i.setTripId(t.getId());
                    i.setDayNumber(d.day());
                    i.setSortOrder(positions.merge(d.day(), 1, Integer::sum) - 1);
                    i.setStartTime(d.startTime());
                    i.setEndTime(d.endTime());
                    i.setTitle(d.title().trim());
                    i.setKind(d.kind());
                    i.setDestinationId(d.destinationId() != null && validIds.contains(d.destinationId()) ? d.destinationId() : null);
                    i.setLat(d.lat());
                    i.setLng(d.lng());
                    i.setNotes(d.notes());
                    i.setEstCost(d.estCost());
                    items.save(i);
                });
    }

    private void saveEstimate(Trip t, List<ItemDraft> drafts, Double oneWayKm) {
        int attractions = (int) drafts.stream().filter(d -> "attraction".equals(d.kind())).count();
        var est = estimator.estimate(new BudgetEstimator.Input(oneWayKm, t.getTransport(), t.days(), t.getTravellers(), t.getBudget(), attractions));
        for (BudgetEstimator.Line l : est.lines()) {
            BudgetCategory b = new BudgetCategory();
            b.setTripId(t.getId());
            b.setCategory(l.category());
            b.setPlanned(l.planned());
            b.setBasis(l.basis());
            budgets.save(b);
        }
    }

    // ---------- budget & expenses ----------

    @Transactional
    public BudgetSummary updatePlanned(String id, List<TripDtos.PlannedLine> lines, AppUser user) {
        Trip t = requireOwner(id, user);
        Map<String, BudgetCategory> existing = budgets.findByTripId(t.getId()).stream()
                .collect(Collectors.toMap(BudgetCategory::getCategory, Function.identity()));
        for (TripDtos.PlannedLine l : lines) {
            BudgetCategory b = existing.get(l.category());
            if (b == null) {
                b = new BudgetCategory();
                b.setTripId(t.getId());
                b.setCategory(l.category());
            }
            if (b.getBasis() == null || b.getPlanned() != l.planned()) b.setBasis("set manually");
            b.setPlanned(l.planned());
            budgets.save(b);
        }
        return budgetSummary(t);
    }

    @Transactional
    public ExpenseDto addExpense(String id, TripDtos.ExpenseRequest req, AppUser user) {
        Trip t = requireView(id, user);
        Expense e = new Expense();
        e.setTripId(t.getId());
        e.setUserId(user.id());
        e.setCategory(req.category());
        e.setAmount(req.amount());
        e.setNote(req.note() == null || req.note().isBlank() ? null : req.note().trim());
        if (req.spentOn() != null) e.setSpentOn(req.spentOn());
        expenses.save(e);
        return new ExpenseDto(e.getId(), e.getCategory(), e.getAmount(), e.getNote(), e.getSpentOn(), user.id(), user.name(), true);
    }

    @Transactional
    public void deleteExpense(String tripId, String expenseId, AppUser user) {
        Trip t = requireView(tripId, user);
        Expense e = expenses.findById(expenseId).filter(x -> x.getTripId().equals(t.getId()))
                .orElseThrow(() -> ApiException.notFound("Expense"));
        if (!e.getUserId().equals(user.id()) && !t.getOwnerId().equals(user.id())) throw ApiException.forbidden();
        expenses.delete(e);
    }

    public BudgetSummary budgetSummary(Trip t) {
        Map<String, Integer> actual = new HashMap<>();
        for (Expense e : expenses.findByTripIdOrderBySpentOnDescCreatedAtDesc(t.getId())) actual.merge(e.getCategory(), e.getAmount(), Integer::sum);
        Map<String, BudgetCategory> planned = budgets.findByTripId(t.getId()).stream()
                .collect(Collectors.toMap(BudgetCategory::getCategory, Function.identity()));
        List<BudgetLine> lines = new ArrayList<>();
        for (String c : BudgetEstimator.CATEGORIES) {
            BudgetCategory b = planned.get(c);
            lines.add(new BudgetLine(c, b == null ? 0 : b.getPlanned(), actual.getOrDefault(c, 0), b == null ? null : b.getBasis()));
        }
        int plannedTotal = lines.stream().mapToInt(BudgetLine::planned).sum();
        int actualTotal = lines.stream().mapToInt(BudgetLine::actual).sum();
        int people = Math.max(1, t.getTravellers());
        return new BudgetSummary(t.getBudget(), t.getTravellers(), lines, plannedTotal, actualTotal, t.getBudget() - actualTotal,
                Math.round(plannedTotal / (float) people), Math.round(actualTotal / (float) people));
    }

    // ---------- read ----------

    @Transactional(readOnly = true)
    public List<TripSummary> mine(AppUser user) {
        Map<String, TripSummary> out = new LinkedHashMap<>();
        for (Trip t : trips.findByOwnerIdOrderByStartDateDesc(user.id())) out.put(t.getId(), summary(t, "owner"));
        Set<String> roomIds = members.findByUserId(user.id()).stream().map(m -> m.getRoomId()).collect(Collectors.toSet());
        for (TravelRoom r : rooms.findAllById(roomIds)) {
            if (r.getTripId() != null && !out.containsKey(r.getTripId())) {
                trips.findById(r.getTripId()).ifPresent(t -> out.put(t.getId(), summary(t, "member")));
            }
        }
        return out.values().stream().sorted((a, b) -> b.startDate().compareTo(a.startDate())).toList();
    }

    public static TripSummary summary(Trip t, String role) {
        return new TripSummary(t.getId(), t.getTitle(), t.getOrigin(), t.getCity(), t.getStartDate(), t.getEndDate(), t.days(),
                t.getTravellers(), t.getBudget(), t.getGeneratedBy(), role, t.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public TripDetail get(String id, AppUser user) {
        return detail(requireView(id, user), user);
    }

    @Transactional(readOnly = true)
    public TripDetail shared(String token) {
        Trip t = trips.findByShareToken(token).orElseThrow(() -> ApiException.notFound("Shared trip"));
        BudgetSummary b = budgetSummary(t);
        // Public view: planned budget only — actual spending and group details stay private.
        BudgetSummary publicBudget = new BudgetSummary(b.budget(), b.travellers(),
                b.lines().stream().map(l -> new BudgetLine(l.category(), l.planned(), 0, l.basis())).toList(),
                b.plannedTotal(), 0, b.budget(), b.perPersonPlanned(), 0);
        return build(t, false, false, publicBudget, List.of(), List.of(), true);
    }

    private TripDetail detail(Trip t, AppUser user) {
        boolean owner = t.getOwnerId().equals(user.id());
        Map<String, String> names = new HashMap<>();
        List<Expense> ex = expenses.findByTripIdOrderBySpentOnDescCreatedAtDesc(t.getId());
        users.findAllById(ex.stream().map(Expense::getUserId).distinct().toList()).forEach(u -> names.put(u.getId(), u.getName()));
        List<ExpenseDto> expenseDtos = ex.stream().map(e -> new ExpenseDto(e.getId(), e.getCategory(), e.getAmount(), e.getNote(),
                e.getSpentOn(), e.getUserId(), names.getOrDefault(e.getUserId(), "Former member"),
                owner || e.getUserId().equals(user.id()))).toList();
        List<RoomRef> roomRefs = rooms.findByTripId(t.getId()).stream()
                .filter(r -> members.existsByRoomIdAndUserId(r.getId(), user.id()))
                .map(r -> new RoomRef(r.getId(), r.getName())).toList();
        return build(t, owner, owner, budgetSummary(t), expenseDtos, roomRefs, false);
    }

    private TripDetail build(Trip t, boolean canEdit, boolean owner, BudgetSummary budget, List<ExpenseDto> ex, List<RoomRef> roomRefs, boolean hideShare) {
        List<ItineraryItem> rows = items.findByTripIdOrderByDayNumberAscSortOrderAsc(t.getId());
        Map<String, String> slugs = destinations.findAllById(rows.stream().map(ItineraryItem::getDestinationId).filter(x -> x != null).distinct().toList())
                .stream().collect(Collectors.toMap(Destination::getId, Destination::getSlug));
        List<ItemDto> itemDtos = rows.stream().map(i -> new ItemDto(i.getId(), i.getDayNumber(), i.getSortOrder(), i.getStartTime(), i.getEndTime(),
                i.getTitle(), i.getKind(), i.getDestinationId(), slugs.get(i.getDestinationId()), i.getLat(), i.getLng(), i.getNotes(), i.getEstCost())).toList();
        return new TripDetail(t.getId(), t.getTitle(), t.getOrigin(), t.getOriginLat(), t.getOriginLng(), t.getCity(), t.getStartDate(), t.getEndDate(),
                t.days(), t.getTravellers(), t.getBudget(), t.getInterests().isBlank() ? List.of() : List.of(t.getInterests().split(",")),
                t.getTransport(), t.getPace(), t.getGeneratedBy(), t.getNotes(), hideShare || !owner ? null : t.getShareToken(),
                canEdit, owner, itemDtos, budget, ex, roomRefs, t.getUpdatedAt());
    }
}
