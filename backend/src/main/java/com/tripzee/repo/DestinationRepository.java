package com.tripzee.repo;

import com.tripzee.domain.Destination;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DestinationRepository extends JpaRepository<Destination, String> {

    @EntityGraph(attributePaths = "category")
    Optional<Destination> findBySlug(String slug);

    @EntityGraph(attributePaths = "category")
    List<Destination> findByPublishedTrue();

    @EntityGraph(attributePaths = "category")
    List<Destination> findByCityIgnoreCaseAndPublishedTrue(String city);

    @EntityGraph(attributePaths = "category")
    @Query("select d from Destination d order by d.city, d.name")
    List<Destination> findAllForAdmin();

    @EntityGraph(attributePaths = "category")
    List<Destination> findByLatBetweenAndLngBetweenAndPublishedTrue(double minLat, double maxLat, double minLng, double maxLng);

    @Query("""
            select d.city, count(d), avg(d.lat), avg(d.lng) from Destination d
            where d.published = true group by d.city order by count(d) desc, d.city""")
    List<Object[]> cities();

    long countByPublishedTrue();

    long countByFactsVerifiedTrue();

    @Query("select d.id from Destination d where d.wikiTitle is not null and (d.imageUrl is null or d.coordsSource is null)")
    List<String> idsNeedingEnrichment();
}
