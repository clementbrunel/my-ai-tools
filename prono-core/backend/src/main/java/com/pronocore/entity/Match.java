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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "team_a_id", nullable = false)
    private Team teamA;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "team_b_id", nullable = false)
    private Team teamB;

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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "competition_id", nullable = false)
    private Competition competition;

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

    @Column(name = "sync_locked", nullable = false)
    @Builder.Default
    private boolean syncLocked = false;

    @Column(name = "auto_synced", nullable = false)
    @Builder.Default
    private boolean autoSynced = false;

    @OneToOne(mappedBy = "match", cascade = CascadeType.ALL, orphanRemoval = true)
    private MatchExternalLinks externalLinks;

    public enum Status {
        UPCOMING, ONGOING, FINISHED
    }

    public enum MatchPhase {
        POOL, KNOCKOUT
    }
}
