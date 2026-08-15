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

    @Column(name = "football_data_match_id")
    private Long footballDataMatchId;

    public Map<String, Long> toMap() {
        Map<String, Long> map = new LinkedHashMap<>();
        if (footballDataMatchId != null) map.put(ExternalApi.FOOTBALL_DATA_CODE, footballDataMatchId);
        return map;
    }
}
