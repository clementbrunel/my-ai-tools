package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

/** A registered external data provider, scoped to the sport it feeds. */
@Entity
@Table(name = "external_apis")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExternalApi {

    /** Registry code of the provider backing {@code match_external_links.football_data_match_id}. */
    public static final String FOOTBALL_DATA_CODE = "FOOTBALL-DATA";

    /** Registry code of the jolpica-f1 provider feeding races, grids and results. */
    public static final String JOLPICA_CODE = "JOLPICA";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    /** UPPERCASE provider code, e.g. "FOOTBALL-DATA". */
    @Column(nullable = false, length = 50, unique = true)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Sport sport;

    @Column(name = "base_url", length = 255)
    private String baseUrl;

    @Column(columnDefinition = "TEXT")
    private String description;
}
