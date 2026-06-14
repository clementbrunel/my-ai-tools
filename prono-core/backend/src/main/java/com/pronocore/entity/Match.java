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
    private String round = "Group Stage";

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
}
