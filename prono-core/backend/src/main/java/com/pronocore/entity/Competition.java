package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "competitions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Competition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private Sport sport = Sport.FOOT;

    /** Inactive competitions are hidden by default from the public match/race filters. */
    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    /** jolpica season year (e.g. 2026) — F1 only, null for FOOT competitions. */
    private Integer season;

    @ManyToMany
    @JoinTable(
        name = "competition_teams",
        joinColumns = @JoinColumn(name = "competition_id"),
        inverseJoinColumns = @JoinColumn(name = "team_id")
    )
    @OrderBy("name ASC")
    @Builder.Default
    private List<Team> teams = new ArrayList<>();
}
