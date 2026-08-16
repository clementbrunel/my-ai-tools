package com.pronocore.dto.response;

import lombok.Builder;

import java.util.List;

/** Result of importing a competition's fixtures from football-data.org. */
@Builder
public record FixtureImportResponse(List<MatchResponse> created, List<MatchResponse> rescheduled) {}
