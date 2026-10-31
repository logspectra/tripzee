package com.tripzee.auth;

import com.tripzee.common.ApiException;
import com.tripzee.domain.User;
import com.tripzee.repo.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final SecurityContextRepository contextRepository;
    private final LoginRateLimiter limiter;

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 80) String name,
            @NotBlank @Email @Size(max = 200) String email,
            @NotBlank @Size(min = 8, max = 200, message = "Password must be at least 8 characters") String password) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank @Size(max = 200) String password) {}

    public record UpdateMeRequest(@Size(min = 2, max = 80) String name, @Pattern(regexp = "en|hi") String locale) {}

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> register(@Valid @RequestBody RegisterRequest body, HttpServletRequest req, HttpServletResponse res) {
        limiter.check("auth:" + req.getRemoteAddr());
        String email = body.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email)) throw ApiException.conflict("An account with this email already exists");
        User u = new User();
        u.setEmail(email);
        u.setName(body.name().trim());
        u.setPasswordHash(encoder.encode(body.password()));
        users.save(u);
        return signIn(u, req, res);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest body, HttpServletRequest req, HttpServletResponse res) {
        limiter.check("auth:" + req.getRemoteAddr());
        User u = users.findByEmail(body.email().trim().toLowerCase(Locale.ROOT))
                .filter(x -> encoder.matches(body.password(), x.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Incorrect email or password"));
        if (!User.ACTIVE.equals(u.getStatus())) throw new ApiException(HttpStatus.FORBIDDEN, "This account has been suspended");
        return signIn(u, req, res);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest req) {
        HttpSession s = req.getSession(false);
        if (s != null) s.invalidate();
        SecurityContextHolder.clearContext();
        return Map.of("ok", true);
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        Map<String, Object> out = new HashMap<>();
        out.put("user", CurrentUser.get().orElse(null));
        return out;
    }

    @PatchMapping("/me")
    public Map<String, Object> updateMe(@Valid @RequestBody UpdateMeRequest body) {
        User u = users.findById(CurrentUser.require().id()).orElseThrow(() -> ApiException.notFound("User"));
        if (body.name() != null) u.setName(body.name().trim());
        if (body.locale() != null) u.setLocale(body.locale());
        users.save(u);
        return Map.of("user", AppUser.of(u));
    }

    private Map<String, Object> signIn(User u, HttpServletRequest req, HttpServletResponse res) {
        if (req.getSession(false) != null) req.changeSessionId(); // session-fixation protection
        AppUser principal = AppUser.of(u);
        var ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(CurrentUser.authentication(principal));
        SecurityContextHolder.setContext(ctx);
        contextRepository.saveContext(ctx, req, res);
        return Map.of("user", principal);
    }
}
