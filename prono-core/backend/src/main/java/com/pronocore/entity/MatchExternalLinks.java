package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One row per match.  Each column holds the external match/fixture ID
 * for a given API provider.  Adding a new API = new Flyway migration
 * that adds a column here + a new field below.
 */
@Entity
@Table(name = "match_external_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchExternalLinks {

    @Id
    @Column(name = "match_id")
    private Long matchId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "match_id")
    private Match match;

    // ── API-FOOTBALL ─────────────────────────────────────────────
    @Column(name = "api_football_fixture_id")
    private Long apiFootballFixtureId;

    // ── future: @Column(name = "sofascore_id") Long sofascoreId; ─

    // ----------------------------------------------------------------

    /**
     * Returns a Map&lt;API_CODE, external_id&gt; containing only non-null entries.
     * Used by MatchMapper to populate MatchResponse.externalLinks.
     */
    public Map<String, Long> toMap() {
        Map<String, Long> map = new LinkedHashMap<>();
        if (apiFootballFixtureId != null) map.put("API-FOOTBALL", apiFootballFixtureId);
        return map;
    }
}
