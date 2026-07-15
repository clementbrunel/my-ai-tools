package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "races")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Race {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "country_iso2", length = 10)
    private String countryIso2;

    @Column(length = 100)
    private String circuit;

    /** Championship round, 1..24. */
    @Column(nullable = false)
    private int round;

    /** Locks the pole pick. */
    @Column(name = "qualifying_date", nullable = false)
    private LocalDateTime qualifyingDate;

    /** Locks every other pick. */
    @Column(name = "race_date", nullable = false)
    private LocalDateTime raceDate;

    /** Sprint start when the weekend has one — no betting, championship points only. */
    @Column(name = "sprint_date")
    private LocalDateTime sprintDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.UPCOMING;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "competition_id", nullable = false)
    private Competition competition;

    @Column(name = "reminder_sent", nullable = false)
    @Builder.Default
    private boolean reminderSent = false;

    public enum Status {
        UPCOMING, FINISHED
    }
}
