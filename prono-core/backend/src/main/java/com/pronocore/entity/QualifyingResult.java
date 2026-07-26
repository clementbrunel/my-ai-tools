package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Starting grid position of a driver, known as soon as qualifying is over —
 * well before {@link RaceResult}, which requires the full race classification.
 * Display only: settlement never reads from this table.
 */
@Entity
@Table(name = "qualifying_results",
       uniqueConstraints = @UniqueConstraint(columnNames = {"race_id", "driver_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QualifyingResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "race_id", nullable = false)
    private Race race;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "driver_id", nullable = false)
    private Driver driver;

    @Column(nullable = false)
    private Integer position;
}
