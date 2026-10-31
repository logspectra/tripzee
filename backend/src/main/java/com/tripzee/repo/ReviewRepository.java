package com.tripzee.repo;

import com.tripzee.domain.Review;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, String> {

    boolean existsByUserIdAndDestinationId(String userId, String destinationId);

    Optional<Review> findByUserIdAndDestinationId(String userId, String destinationId);

    @Query(value = """
            select r from Review r join fetch r.user
            where r.destinationId = :destinationId and r.status = 'VISIBLE'
              and (:rating is null or r.rating = :rating)
              and (:tipsOnly = false or r.tip is not null)""",
            countQuery = """
            select count(r) from Review r
            where r.destinationId = :destinationId and r.status = 'VISIBLE'
              and (:rating is null or r.rating = :rating)
              and (:tipsOnly = false or r.tip is not null)""")
    Page<Review> forDestination(@Param("destinationId") String destinationId, @Param("rating") Integer rating,
                                @Param("tipsOnly") boolean tipsOnly, Pageable pageable);

    @Query(value = """
            select r from Review r join fetch r.user join fetch r.destination d
            where r.status = 'VISIBLE'
              and (:minRating is null or r.rating >= :minRating)
              and (:tipsOnly = false or r.tip is not null)
              and (:city is null or d.city = :city)""",
            countQuery = """
            select count(r) from Review r join r.destination d
            where r.status = 'VISIBLE'
              and (:minRating is null or r.rating >= :minRating)
              and (:tipsOnly = false or r.tip is not null)
              and (:city is null or d.city = :city)""")
    Page<Review> community(@Param("minRating") Integer minRating, @Param("tipsOnly") boolean tipsOnly,
                           @Param("city") String city, Pageable pageable);

    @Query("""
            select r.destinationId, avg(r.rating), count(r) from Review r
            where r.status = 'VISIBLE' and r.destinationId in :ids group by r.destinationId""")
    List<Object[]> ratingStats(@Param("ids") Collection<String> ids);

    @Query("""
            select r.rating, count(r) from Review r
            where r.status = 'VISIBLE' and r.destinationId = :destinationId group by r.rating""")
    List<Object[]> histogram(@Param("destinationId") String destinationId);

    @Query(value = "select r from Review r join fetch r.user join fetch r.destination where (:status is null or r.status = :status)",
            countQuery = "select count(r) from Review r where (:status is null or r.status = :status)")
    Page<Review> forAdmin(@Param("status") String status, Pageable pageable);

    long countByStatus(String status);
}
