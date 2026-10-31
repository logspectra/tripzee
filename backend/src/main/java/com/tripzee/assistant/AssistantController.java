package com.tripzee.assistant;

import com.tripzee.auth.LoginRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assistant")
@RequiredArgsConstructor
public class AssistantController {
    private final AssistantService assistant;
    private final LoginRateLimiter limiter;

    public record AskRequest(@NotBlank @Size(max = 1000) String message,
                             @Pattern(regexp = "en|hi") String locale,
                             @Size(max = 20) List<AssistantService.Turn> history,
                             @Size(max = 120) String destinationSlug) {}

    @PostMapping
    public AssistantService.Reply ask(@Valid @RequestBody AskRequest body, HttpServletRequest req) {
        limiter.check("assistant:" + req.getRemoteAddr(), 40, 10 * 60_000L);
        return assistant.answer(body.message().trim(), body.locale() == null ? "en" : body.locale(), body.history(), body.destinationSlug());
    }
}
