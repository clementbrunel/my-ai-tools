package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "competition_teams",
       uniqueConstraints = @UniqueConstraint(columnNames = {"competition", "team_name"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompetitionTeam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String competition;

    @Column(name = "team_name", nullable = false, length = 100)
    private String teamName;
}
