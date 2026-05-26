package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "bets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Bet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id")
    private Match match;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id", nullable = false)
    private User creator;

    @Enumerated(EnumType.STRING)
    @Column(name = "bet_type", nullable = false)
    @Builder.Default
    private BetType betType = BetType.FREE;

    @Column(nullable = false)
    @Builder.Default
    private int points = 10;

    @Column(nullable = false)
    private LocalDateTime deadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.OPEN;

    @Column(name = "winning_option", length = 200)
    private String winningOption;

    /** Optional forfeit applied to users who lose this bet. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "forfeit_id")
    private Forfeit forfeit;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum BetType {
        SCORE, EVENT, FORFEIT, FREE
    }

    public enum Status {
        OPEN, VALIDATED, CANCELLED
    }
}
