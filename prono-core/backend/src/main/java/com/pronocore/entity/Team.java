package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "teams")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String name;

    @Column(length = 10)
    private String iso2;

    /** Club crest image URL from football-data.org — logo fallback for teams with no iso2. */
    @Column(length = 500)
    private String crestUrl;
}
