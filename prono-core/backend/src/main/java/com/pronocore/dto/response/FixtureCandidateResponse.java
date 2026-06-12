package com.pronocore.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class FixtureCandidateResponse {
    private long          fixtureId;
    private String        homeTeam;
    private String        awayTeam;
    private OffsetDateTime date;
    private double        confidence;
    private boolean       autoLinkable;
}
