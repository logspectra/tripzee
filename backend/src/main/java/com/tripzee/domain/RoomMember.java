package com.tripzee.domain;

import com.tripzee.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "room_members")
@Getter
@Setter
public class RoomMember extends BaseEntity {
    public static final String OWNER = "OWNER";
    public static final String MEMBER = "MEMBER";

    private String roomId;

    @Column(name = "user_id")
    private String userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    private String role = MEMBER;
    private boolean sharingLocation;
    /** When the member last explicitly opted in to location sharing. */
    private Instant consentAt;
    private Instant joinedAt = Instant.now();
}
