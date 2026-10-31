package com.tripzee.destination;

import com.tripzee.common.PageResponse;
import com.tripzee.destination.DestinationDtos.CategoryDto;
import com.tripzee.destination.DestinationDtos.DestinationCard;
import com.tripzee.destination.DestinationDtos.DestinationDetail;
import com.tripzee.common.AppProperties;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DestinationController {
    private final DestinationService service;
    private final AppProperties props;

    /** Tells the frontend which optional integrations are configured (never exposes secrets). */
    @GetMapping("/meta")
    public Map<String, Object> meta() {
        return Map.of("aiEnabled", props.llm().enabled(), "externalLookups", props.externalLookups());
    }

    @GetMapping("/destinations")
    public PageResponse<DestinationCard> list(@RequestParam(required = false) String q,
                                              @RequestParam(required = false) String city,
                                              @RequestParam(required = false) String category,
                                              @RequestParam(required = false) String interest,
                                              @RequestParam(defaultValue = "name") String sort,
                                              @RequestParam(defaultValue = "1") int page,
                                              @RequestParam(defaultValue = "24") int pageSize) {
        return service.search(new DestinationService.SearchQuery(q, city, category, interest, sort, page, pageSize));
    }

    @GetMapping("/destinations/cities")
    public List<DestinationService.CityDto> cities() {
        return service.cities();
    }

    @GetMapping("/destinations/near")
    public List<DestinationCard> near(@RequestParam double lat, @RequestParam double lng,
                                      @RequestParam(defaultValue = "25") double radiusKm) {
        return service.near(lat, lng, Math.min(Math.max(radiusKm, 1), 300), null);
    }

    @GetMapping("/destinations/{slug}")
    public DestinationDetail detail(@PathVariable String slug) {
        return service.detail(slug);
    }

    @GetMapping("/categories")
    public List<CategoryDto> categories() {
        return service.categories();
    }
}
