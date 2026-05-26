package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Role role = Role.USER;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "global_score", nullable = false)
    @Builder.Default
    private int globalScore = 0;

    @Column(name = "bets_won", nullable = false)
    @Builder.Default
    private int betsWon = 0;

    @Column(name = "forfeits_received", nullable = false)
    @Builder.Default
    private int forfeitsReceived = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum Role {
        ADMIN, USER
    }
}
