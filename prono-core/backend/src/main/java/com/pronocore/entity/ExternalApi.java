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

    /** Registry code of the provider backing {@code match_external_links.api_football_fixture_id}. */
    public static final String API_FOOTBALL_CODE = "API-FOOTBALL";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    /** UPPERCASE provider code, e.g. "API-FOOTBALL". */
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
