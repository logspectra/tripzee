package com.tripzee.repo;

import com.tripzee.domain.BudgetCategory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BudgetCategoryRepository extends JpaRepository<BudgetCategory, String> {
    List<BudgetCategory> findByTripId(String tripId);

    @Modifying
    @Query("delete from BudgetCategory b where b.tripId = :tripId")
    void deleteByTripId(@Param("tripId") String tripId);
}
