package com.tripzee.repo;

import com.tripzee.domain.Report;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, String> {
    boolean existsByReporterIdAndTargetTypeAndTargetId(String reporterId, String targetType, String targetId);

    Page<Report> findByStatus(String status, Pageable pageable);

    long countByStatus(String status);
}
