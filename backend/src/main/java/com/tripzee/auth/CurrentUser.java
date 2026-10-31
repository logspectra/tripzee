package com.tripzee.auth;

import com.tripzee.common.ApiException;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {
    private CurrentUser() {}

    public static Optional<AppUser> get() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof AppUser u ? Optional.of(u) : Optional.empty();
    }

    public static AppUser require() {
        return get().orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Please sign in to continue"));
    }

    public static Optional<String> id() {
        return get().map(AppUser::id);
    }

    public static Authentication authentication(AppUser user) {
        return UsernamePasswordAuthenticationToken.authenticated(user, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.role())));
    }

    public static AppUser fromPrincipal(java.security.Principal p) {
        return p instanceof Authentication a && a.getPrincipal() instanceof AppUser u ? u : null;
    }
}
