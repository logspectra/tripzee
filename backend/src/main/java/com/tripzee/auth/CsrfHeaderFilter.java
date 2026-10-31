package com.tripzee.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * CSRF defence for the JSON API: the session cookie is SameSite=Lax and every state-changing
 * request must carry a custom header, which cross-site forms cannot set and cross-origin
 * scripts cannot send without passing the CORS allow-list.
 */
public class CsrfHeaderFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Tripzee";
    private static final Set<String> SAFE = Set.of("GET", "HEAD", "OPTIONS", "TRACE");

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (req.getRequestURI().startsWith("/api/") && !SAFE.contains(req.getMethod()) && !"1".equals(req.getHeader(HEADER))) {
            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"error\":\"Missing request header\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
