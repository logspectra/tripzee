package com.tripzee.auth;

import com.tripzee.domain.User;
import java.io.Serializable;

/** Session principal. Kept small and serializable; refreshed from the DB on each request. */
public record AppUser(String id, String email, String name, String role, String locale) implements Serializable {

    public static AppUser of(User u) {
        return new AppUser(u.getId(), u.getEmail(), u.getName(), u.getRole(), u.getLocale());
    }

    public boolean isAdmin() {
        return User.ROLE_ADMIN.equals(role);
    }
}
