package com.pronocore.dto.response;

/** A team plus its {@link TeamSummaryResponse} — what the team detail page needs in a single call. */
public record TeamDetailResponse(Long id, String name, String iso2, String crestUrl, TeamSummaryResponse summary) {}
