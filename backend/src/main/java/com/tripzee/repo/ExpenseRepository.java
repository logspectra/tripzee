package com.tripzee.repo;

import com.tripzee.domain.Expense;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenseRepository extends JpaRepository<Expense, String> {
    List<Expense> findByTripIdOrderBySpentOnDescCreatedAtDesc(String tripId);
}
