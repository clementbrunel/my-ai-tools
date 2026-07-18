package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Table(name = "match_external_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchExternalLinks {

    @Id
    private Long matchId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "match_id")
    private Match match;

    @Column(name = "api_football_fixture_id")
    private Long apiFootballFixtureId;

    public Map<String, Long> toMap() {
        Map<String, Long> map = new LinkedHashMap<>();
        if (apiFootballFixtureId != null) map.put("API-FOOTBALL", apiFootballFixtureId);
        return map;
    }
}
