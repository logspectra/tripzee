package com.tripzee.seed;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripzee.common.AppProperties;
import com.tripzee.domain.Category;
import com.tripzee.domain.Destination;
import com.tripzee.domain.SourceReference;
import com.tripzee.domain.User;
import com.tripzee.repo.CategoryRepository;
import com.tripzee.repo.DestinationRepository;
import com.tripzee.repo.SourceReferenceRepository;
import com.tripzee.repo.UserRepository;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Idempotent seed: categories, the curated destination catalogue and the admin account. */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {
    static final String UP_TOURISM = "https://uptourism.gov.in/";

    private final CategoryRepository categories;
    private final DestinationRepository destinations;
    private final SourceReferenceRepository sources;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AppProperties props;
    private final ObjectMapper mapper;

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        seedAdmin();
        JsonNode root;
        try (InputStream in = new ClassPathResource("seed/destinations.json").getInputStream()) {
            root = mapper.readTree(in);
        }
        Map<String, Category> cats = new HashMap<>();
        for (JsonNode c : root.path("categories")) {
            Category cat = categories.findBySlug(c.path("slug").asText()).orElseGet(() -> {
                Category n = new Category();
                n.setSlug(c.path("slug").asText());
                n.setName(c.path("name").asText());
                n.setNameHi(c.path("nameHi").asText());
                return categories.save(n);
            });
            cats.put(cat.getSlug(), cat);
        }
        int added = 0;
        for (JsonNode n : root.path("destinations")) {
            if (destinations.findBySlug(n.path("slug").asText()).isPresent()) continue;
            Destination d = new Destination();
            d.setSlug(n.path("slug").asText());
            d.setName(n.path("name").asText());
            d.setNameHi(text(n, "nameHi"));
            d.setCity(n.path("city").asText());
            d.setCategory(cats.get(n.path("category").asText()));
            d.setLat(n.path("lat").asDouble());
            d.setLng(n.path("lng").asDouble());
            d.setSummary(n.path("summary").asText());
            d.setSummaryHi(text(n, "summaryHi"));
            d.setDescription(n.path("description").asText());
            d.setHistory(text(n, "history"));
            d.setCulturalSignificance(text(n, "culturalSignificance"));
            d.setInterests(n.path("interests").asText(""));
            d.setVisitMinutes(n.path("visitMinutes").asInt(120));
            d.setOpeningHours(text(n, "openingHours"));
            d.setEntryFee(text(n, "entryFee"));
            d.setBestTimeToVisit(text(n, "bestTimeToVisit"));
            d.setAccessibility(text(n, "accessibility"));
            d.setGuidelines(text(n, "guidelines"));
            d.setOfficialUrl(text(n, "officialUrl"));
            d.setTicketUrl(text(n, "ticketUrl"));
            d.setWikiTitle(text(n, "wikiTitle"));
            d.setFactsVerified(false);
            destinations.save(d);
            addSource(d, "UP Tourism — official state tourism portal", UP_TOURISM, "general");
            if (d.getOfficialUrl() != null) addSource(d, "Official website", d.getOfficialUrl(), "openingHours");
            added++;
        }
        if (added > 0) log.info("Seeded {} destinations", added);
    }

    private void seedAdmin() {
        String email = props.adminEmail() == null ? null : props.adminEmail().trim().toLowerCase(Locale.ROOT);
        if (email == null || email.isBlank() || props.adminPassword() == null || props.adminPassword().length() < 8) {
            log.warn("ADMIN_EMAIL/ADMIN_PASSWORD not set (password needs 8+ chars) — no admin account seeded");
            return;
        }
        if (users.existsByEmail(email)) return;
        User u = new User();
        u.setEmail(email);
        u.setName("Tripzee Admin");
        u.setRole(User.ROLE_ADMIN);
        u.setPasswordHash(encoder.encode(props.adminPassword()));
        users.save(u);
        log.info("Seeded admin account {}", email);
    }

    private void addSource(Destination d, String label, String url, String field) {
        SourceReference s = new SourceReference();
        s.setDestination(d);
        s.setLabel(label);
        s.setUrl(url);
        s.setField(field);
        sources.save(s);
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() || v.asText().isBlank() ? null : v.asText();
    }
}
