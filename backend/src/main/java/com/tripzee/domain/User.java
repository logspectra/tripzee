package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User extends BaseEntity {
    public static final String ROLE_USER = "USER";
    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ACTIVE = "ACTIVE";
    public static final String SUSPENDED = "SUSPENDED";

    private String email;
    private String passwordHash;
    private String name;
    private String role = ROLE_USER;
    private String status = ACTIVE;
    private String locale = "en";
    private Instant createdAt = Instant.now();

    public boolean isAdmin() {
        return ROLE_ADMIN.equals(role);
    }
}
