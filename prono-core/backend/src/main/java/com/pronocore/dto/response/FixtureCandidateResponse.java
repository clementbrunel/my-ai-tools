package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FixtureCandidateResponse {
    private Long fixtureId;
    private String homeTeam;
    private String awayTeam;
    private LocalDateTime date;
    private double confidence;
    private boolean autoLinkable;
}
