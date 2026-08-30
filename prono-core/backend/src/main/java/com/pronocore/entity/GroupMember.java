package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_members", uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private GroupRole role = GroupRole.MEMBER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private MemberStatus status = MemberStatus.ACTIVE;

    /** Per-group override of {@link User#isEmailReminderEnabled()}. Null = inherit the user's global default. */
    @Column(name = "email_reminder_enabled")
    private Boolean emailReminderEnabled;

    /** Per-group override of {@link User#isEmailGageEnabled()}. Null = inherit the user's global default. */
    @Column(name = "email_gage_enabled")
    private Boolean emailGageEnabled;

    @CreationTimestamp
    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    public boolean isEffectiveEmailReminderEnabled() {
        return emailReminderEnabled != null ? emailReminderEnabled : user.isEmailReminderEnabled();
    }

    public boolean isEffectiveEmailGageEnabled() {
        return emailGageEnabled != null ? emailGageEnabled : user.isEmailGageEnabled();
    }

    public enum GroupRole {
        GROUP_ADMIN, MEMBER
    }

    public enum MemberStatus {
        ACTIVE, PENDING
    }
}
