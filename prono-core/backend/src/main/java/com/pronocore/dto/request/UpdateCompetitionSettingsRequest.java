package com.pronocore.dto.request;

import lombok.Data;

/**
 * Season and football-data.org competition code are edited together as one admin form —
 * no reason to split them into two round trips.
 */
@Data
public class UpdateCompetitionSettingsRequest {

    /** Null clears the season. Used by F1 to derive the jolpica season, free-form for other sports. */
    private Integer season;

    /** Null clears the code (disables automatic fixture/score sync for this competition). */
    private String footballDataCompetitionCode;
}
