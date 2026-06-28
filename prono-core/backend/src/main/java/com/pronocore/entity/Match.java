package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "matches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_a", nullable = false, length = 100)
    private String teamA;

    @Column(name = "team_b", nullable = false, length = 100)
    private String teamB;

    @Column(name = "match_date", nullable = false)
    private LocalDateTime matchDate;

    @Column(name = "score_a")
    private Integer scoreA;

    @Column(name = "score_b")
    private Integer scoreB;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.UPCOMING;

    @Column(nullable = false, length = 100)
    @Builder.Default
    private String competition = "FIFA World Cup 2026";

    @Column(nullable = false, length = 100)
    @Builder.Default
    private String round = "";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MatchPhase phase = MatchPhase.POOL;

    @Column(name = "penalty_winner", length = 1)
    private String penaltyWinner;

    @Column(name = "penalty_score_a")
    private Integer penaltyScoreA;

    @Column(name = "penalty_score_b")
    private Integer penaltyScoreB;

    @Column(name = "reminder_sent", nullable = false)
    @Builder.Default
    private boolean reminderSent = false;

    public enum Status {
        UPCOMING, ONGOING, FINISHED
    }

    public enum MatchPhase {
        POOL, KNOCKOUT
    }
}
