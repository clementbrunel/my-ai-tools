package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "race_results",
       uniqueConstraints = @UniqueConstraint(columnNames = {"race_id", "driver_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RaceResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "race_id", nullable = false)
    private Race race;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "driver_id", nullable = false)
    private Driver driver;

    /** Final classification, null when the driver was not classified. */
    @Column
    private Integer position;

    /** Sprint classification — feeds the standings (8-7-6-5-4-3-2-1), no betting. */
    @Column(name = "sprint_position")
    private Integer sprintPosition;

    @Column(nullable = false)
    @Builder.Default
    private boolean pole = false;

    @Column(name = "fastest_lap", nullable = false)
    @Builder.Default
    private boolean fastestLap = false;

    @Column(nullable = false)
    @Builder.Default
    private boolean dnf = false;
}
