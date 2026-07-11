package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Structured payload of an F1 "Podium +" prediction, attached to a regular
 * bet participation. The participation keeps a human-readable summary in
 * chosenOption and receives the computed pointsEarned at settlement, so the
 * generic pipeline (leaderboard, daily gages, forfeits) works untouched.
 */
@Entity
@Table(name = "f1_predictions",
       uniqueConstraints = @UniqueConstraint(columnNames = {"participation_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class F1Prediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participation_id", nullable = false)
    private BetParticipation participation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "p1_driver_id", nullable = false)
    private Driver p1;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "p2_driver_id", nullable = false)
    private Driver p2;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "p3_driver_id", nullable = false)
    private Driver p3;

    /** Frozen once qualifying starts; null when never picked before the lock. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pole_driver_id")
    private Driver pole;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fastest_lap_driver_id")
    private Driver fastestLap;

    /** "Lanterne rouge" — last classified finisher. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_classified_driver_id")
    private Driver lastClassified;
}
