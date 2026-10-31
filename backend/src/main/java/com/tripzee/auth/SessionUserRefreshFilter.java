package com.tripzee.auth;

import com.tripzee.domain.User;
import com.tripzee.repo.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Re-reads the session user from the DB on every request so role changes and
 * suspensions take effect immediately instead of when the session expires.
 */
@RequiredArgsConstructor
public class SessionUserRefreshFilter extends OncePerRequestFilter {
    private final UserRepository users;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        Optional<AppUser> current = CurrentUser.get();
        if (current.isPresent()) {
            Optional<User> fresh = users.findById(current.get().id()).filter(u -> User.ACTIVE.equals(u.getStatus()));
            HttpSession session = req.getSession(false);
            if (fresh.isEmpty()) {
                SecurityContextHolder.clearContext();
                if (session != null) session.invalidate();
            } else {
                AppUser updated = AppUser.of(fresh.get());
                if (!updated.equals(current.get())) {
                    var ctx = SecurityContextHolder.createEmptyContext();
                    ctx.setAuthentication(CurrentUser.authentication(updated));
                    SecurityContextHolder.setContext(ctx);
                    if (session != null) {
                        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, ctx);
                    }
                }
            }
        }
        chain.doFilter(req, res);
    }
}
