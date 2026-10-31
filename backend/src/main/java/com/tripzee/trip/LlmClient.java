package com.tripzee.trip;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripzee.common.AppProperties;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Minimal client for any OpenAI-compatible chat-completions API. Only used server-side. */
@Slf4j
@Component
@RequiredArgsConstructor
public class LlmClient {
    private final RestClient http;
    private final AppProperties props;

    public record Message(String role, String content) {}

    public boolean enabled() {
        return props.llm().enabled();
    }

    /** Returns the assistant message content, or throws if the call fails. */
    public String chat(List<Message> messages, boolean jsonMode) {
        Map<String, Object> body = new java.util.HashMap<>(Map.of(
                "model", props.llm().model(),
                "temperature", 0.4,
                "messages", messages));
        if (jsonMode) body.put("response_format", Map.of("type", "json_object"));
        long start = System.currentTimeMillis();
        try {
            JsonNode res = http.post().uri(props.llm().baseUrl().replaceAll("/$", "") + "/chat/completions")
                    .header("Authorization", "Bearer " + props.llm().apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve().body(JsonNode.class);
            String content = res.path("choices").path(0).path("message").path("content").asText(null);
            if (content == null || content.isBlank()) throw new IllegalStateException("Empty LLM response");
            log.debug("LLM call ok in {} ms", System.currentTimeMillis() - start);
            return content;
        } catch (RuntimeException e) {
            log.error("LLM call failed after {} ms: {}", System.currentTimeMillis() - start, e.getMessage());
            throw e;
        }
    }
}
