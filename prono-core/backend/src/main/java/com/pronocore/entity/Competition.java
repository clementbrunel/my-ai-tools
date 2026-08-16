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

    /** Season year (e.g. 2026), admin-editable — optional for any sport, used by F1 to derive the jolpica season. */
    private Integer season;

    /** football-data.org competition code (e.g. "FL1" = Ligue 1) — null disables fixture/team sync via this provider. */
    @Column(name = "football_data_competition_code", length = 10)
    private String footballDataCompetitionCode;

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
