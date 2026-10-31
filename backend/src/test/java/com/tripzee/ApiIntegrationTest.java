package com.tripzee;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripzee.auth.LoginRateLimiter;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired LoginRateLimiter limiter;

    @BeforeEach
    void resetLimiter() {
        limiter.reset();
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, MockHttpSession s, Object body) throws Exception {
        b.header("X-Tripzee", "1").contentType(MediaType.APPLICATION_JSON);
        if (s != null) b.session(s);
        if (body != null) b.content(body instanceof String str ? str : mapper.writeValueAsString(body));
        return b;
    }

    private JsonNode body(MvcResult r) throws Exception {
        return mapper.readTree(r.getResponse().getContentAsString());
    }

    private MockHttpSession register(String name) throws Exception {
        String email = name.toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        MvcResult r = mvc.perform(json(post("/api/auth/register"), null,
                        "{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                .andExpect(status().isCreated()).andReturn();
        return (MockHttpSession) r.getRequest().getSession(false);
    }

    private MockHttpSession admin() throws Exception {
        MvcResult r = mvc.perform(json(post("/api/auth/login"), null, "{\"email\":\"admin@test.local\",\"password\":\"Admin-Test-123\"}"))
                .andExpect(status().isOk()).andReturn();
        return (MockHttpSession) r.getRequest().getSession(false);
    }

    private String planJson() {
        LocalDate start = LocalDate.now().plusDays(10);
        return """
                {"origin":"Lucknow","city":"Agra","startDate":"%s","endDate":"%s","travellers":2,"budget":20000,
                 "interests":["history"],"transport":"train","pace":"moderate"}""".formatted(start, start.plusDays(1));
    }

    @Test
    void seededCatalogueIsPublic() throws Exception {
        mvc.perform(get("/api/destinations?city=Agra")).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(5));
        mvc.perform(get("/api/destinations/taj-mahal")).andExpect(status().isOk())
                .andExpect(jsonPath("$.factsVerified").value(false))
                .andExpect(jsonPath("$.entryFee").doesNotExist());
    }

    @Test
    void authFlowAndCsrfHeader() throws Exception {
        MockHttpSession s = register("Ravi");
        mvc.perform(get("/api/auth/me").session(s)).andExpect(jsonPath("$.user.name").value("Ravi"));
        // state-changing request without the custom header is rejected
        mvc.perform(post("/api/trips").session(s).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/auth/login"), null, "{\"email\":\"nobody@example.com\",\"password\":\"wrongpass\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/trips")).andExpect(status().isUnauthorized());
    }

    @Test
    void guestCanPlanButMustSignInToSave() throws Exception {
        MvcResult plan = mvc.perform(json(post("/api/trips/plan"), null, planJson())).andExpect(status().isOk()).andReturn();
        JsonNode p = body(plan);
        assertThat(p.get("generatedBy").asText()).isEqualTo("rules");
        assertThat(p.get("days").asInt()).isEqualTo(2);
        assertThat(p.get("items")).isNotEmpty();
        assertThat(p.get("budget").get("total").asInt()).isPositive();
        mvc.perform(json(post("/api/trips"), null, "{\"request\":" + planJson() + "}")).andExpect(status().isUnauthorized());
    }

    @Test
    void tripBudgetExpensesAndPrivateSharing() throws Exception {
        MockHttpSession s = register("Meera");
        JsonNode trip = body(mvc.perform(json(post("/api/trips"), s, "{\"request\":" + planJson() + "}"))
                .andExpect(status().isCreated()).andReturn());
        String id = trip.get("id").asText();
        int planned = trip.get("budgetSummary").get("plannedTotal").asInt();
        assertThat(planned).isPositive();

        mvc.perform(json(post("/api/trips/" + id + "/expenses"), s, "{\"category\":\"food\",\"amount\":1200,\"note\":\"Dinner\"}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/trips/" + id).session(s))
                .andExpect(jsonPath("$.budgetSummary.actualTotal").value(1200))
                .andExpect(jsonPath("$.budgetSummary.remaining").value(20000 - 1200));

        // another user can't see it
        MockHttpSession other = register("Stranger");
        mvc.perform(get("/api/trips/" + id).session(other)).andExpect(status().isNotFound());

        // public share link exposes the plan but not actual spending
        String token = body(mvc.perform(json(post("/api/trips/" + id + "/share"), s, null)).andReturn()).get("shareToken").asText();
        mvc.perform(get("/api/shared/" + token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.expenses").isEmpty())
                .andExpect(jsonPath("$.budgetSummary.actualTotal").value(0))
                .andExpect(jsonPath("$.canEdit").value(false));
    }

    @Test
    void oneReviewPerUserAndReporting() throws Exception {
        MockHttpSession a = register("Kabir");
        String review = "{\"rating\":5,\"title\":\"Wonderful\",\"body\":\"Calm in the early morning, beautiful light.\"}";
        String rid = body(mvc.perform(json(post("/api/destinations/sarnath/reviews"), a, review)).andExpect(status().isCreated()).andReturn())
                .get("id").asText();
        mvc.perform(json(post("/api/destinations/sarnath/reviews"), a, review)).andExpect(status().isConflict());

        MockHttpSession b = register("Neha");
        String report = "{\"targetType\":\"review\",\"targetId\":\"" + rid + "\",\"reason\":\"spam\"}";
        mvc.perform(json(post("/api/reports"), b, report)).andExpect(status().isCreated());
        mvc.perform(json(post("/api/reports"), b, report)).andExpect(status().isConflict());
        mvc.perform(json(post("/api/reports"), a, report)).andExpect(status().isBadRequest()); // own review
    }

    @Test
    void travelRoomLocationRequiresConsentAndMembership() throws Exception {
        MockHttpSession owner = register("Owner");
        JsonNode room = body(mvc.perform(json(post("/api/rooms"), owner, "{\"name\":\"Varanasi crew\"}")).andExpect(status().isCreated()).andReturn());
        String roomId = room.get("id").asText();
        String code = room.get("inviteCode").asText();
        String loc = "{\"lat\":25.31,\"lng\":83.01,\"accuracy\":15}";

        MockHttpSession friend = register("Friend");
        mvc.perform(get("/api/rooms/" + roomId).session(friend)).andExpect(status().isNotFound()); // not a member yet
        mvc.perform(json(post("/api/rooms/join"), friend, "{\"code\":\"" + code + "\"}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(2));

        // no consent → rejected and nothing stored
        mvc.perform(json(post("/api/rooms/" + roomId + "/location"), friend, loc)).andExpect(status().isForbidden());
        mvc.perform(get("/api/rooms/" + roomId).session(owner)).andExpect(jsonPath("$.locations").isEmpty());

        // opt in → visible to members
        mvc.perform(json(post("/api/rooms/" + roomId + "/sharing"), friend, "{\"enabled\":true}")).andExpect(status().isOk());
        mvc.perform(json(post("/api/rooms/" + roomId + "/location"), friend, loc)).andExpect(status().isOk());
        mvc.perform(get("/api/rooms/" + roomId).session(owner)).andExpect(jsonPath("$.locations.length()").value(1));

        // opt out → position deleted immediately
        mvc.perform(json(post("/api/rooms/" + roomId + "/sharing"), friend, "{\"enabled\":false}")).andExpect(status().isOk());
        mvc.perform(get("/api/rooms/" + roomId).session(owner)).andExpect(jsonPath("$.locations").isEmpty());

        // messages and meeting points
        mvc.perform(json(post("/api/rooms/" + roomId + "/messages"), friend, "{\"body\":\"Meet at the ghat?\"}")).andExpect(status().isCreated());
        mvc.perform(json(post("/api/rooms/" + roomId + "/meeting-points"), owner, "{\"name\":\"Assi Ghat\",\"lat\":25.288,\"lng\":83.006}"))
                .andExpect(status().isCreated());

        // owner removes friend → friend loses access
        String friendId = body(mvc.perform(get("/api/auth/me").session(friend)).andReturn()).get("user").get("id").asText();
        mvc.perform(json(delete("/api/rooms/" + roomId + "/members/" + friendId), owner, null)).andExpect(status().isOk());
        mvc.perform(get("/api/rooms/" + roomId).session(friend)).andExpect(status().isNotFound());
    }

    @Test
    void adminAreaIsProtected() throws Exception {
        MockHttpSession user = register("Plain");
        mvc.perform(get("/api/admin/stats").session(user)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/stats")).andExpect(status().isUnauthorized());
        MockHttpSession admin = admin();
        mvc.perform(get("/api/admin/stats").session(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.destinations").value(28));
        // verifying facts requires a source (seed adds sources, so this succeeds)
        String id = body(mvc.perform(get("/api/destinations/sarnath")).andReturn()).get("id").asText();
        mvc.perform(json(post("/api/admin/destinations/" + id + "/verify"), admin, "{\"verified\":true}")).andExpect(status().isOk());
        mvc.perform(get("/api/destinations/sarnath")).andExpect(jsonPath("$.factsVerified").value(true));
    }

    @Test
    void assistantAnswersFromCuratedDataWithoutAi() throws Exception {
        mvc.perform(json(post("/api/assistant"), null, "{\"message\":\"What is the entry fee for Agra Fort?\",\"locale\":\"en\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("rules"))
                .andExpect(jsonPath("$.reply").value(org.hamcrest.Matchers.containsString("not verified")));
    }
}
