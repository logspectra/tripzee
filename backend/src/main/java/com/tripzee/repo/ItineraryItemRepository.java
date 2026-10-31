package com.tripzee.repo;

import com.tripzee.domain.ItineraryItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItineraryItemRepository extends JpaRepository<ItineraryItem, String> {
    List<ItineraryItem> findByTripIdOrderByDayNumberAscSortOrderAsc(String tripId);

    @Modifying
    @Query("delete from ItineraryItem i where i.tripId = :tripId")
    void deleteByTripId(@Param("tripId") String tripId);
}
