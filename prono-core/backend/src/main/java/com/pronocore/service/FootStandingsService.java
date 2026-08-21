package com.pronocore.service;

import com.pronocore.client.FootballDataClient;
import com.pronocore.dto.response.FootStandingResponse;
import com.pronocore.dto.response.FootStandingZone;
import com.pronocore.entity.Competition;
import com.pronocore.repository.CompetitionRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Football league table — a live, unstored proxy onto football-data.org's own standings
 * (tie-breaks included), unlike the F1 championship which is recomputed locally from race
 * results. European/relegation zone highlighting is hardcoded for Ligue 1's current 18-club
 * format, since football-data.org doesn't expose it and the app doesn't track the Coupe de
 * France (whose winner can shift the Europa/Conference allocation) — only the Champions
 * League and relegation zones are shown.
 */
@Service
@RequiredArgsConstructor
public class FootStandingsService {

    private static final String LIGUE1_CODE = "FL1";

    private final CompetitionRepository competitionRepository;
    private final FootballDataClient footballDataClient;

    @Transactional(readOnly = true)
    public List<FootStandingResponse> getStandings(Long competitionId) {
        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new EntityNotFoundException("Competition not found: " + competitionId));
        String code = competition.getFootballDataCompetitionCode();
        if (code == null) {
            throw new IllegalStateException("Competition \"" + competition.getName()
                    + "\" has no football-data.org competition code configured");
        }
        if (footballDataClient.isDisabled()) {
            throw new IllegalStateException("football-data.org sync is disabled — no FOOTBALL_DATA_API_KEY configured");
        }

        return footballDataClient.getStandings(code).stream()
                .map(row -> FootStandingResponse.builder()
                        .position(row.position())
                        .teamName(row.teamName())
                        .teamShortName(row.teamShortName())
                        .crestUrl(row.crestUrl())
                        .played(row.playedGames())
                        .won(row.won())
                        .draw(row.draw())
                        .lost(row.lost())
                        .goalsFor(row.goalsFor())
                        .goalsAgainst(row.goalsAgainst())
                        .goalDifference(row.goalDifference())
                        .points(row.points())
                        .zone(code.equals(LIGUE1_CODE) ? zoneFor(row.position()) : null)
                        .build())
                .toList();
    }

    /** Ligue 1, 18 clubs (2026-27 format): 1-3 C1, 4 C1 quali, 16 barrage, 17-18 relégation. */
    private static FootStandingZone zoneFor(int position) {
        return switch (position) {
            case 1, 2, 3 -> FootStandingZone.CHAMPIONS_LEAGUE;
            case 4 -> FootStandingZone.CHAMPIONS_LEAGUE_QUALIFYING;
            case 16 -> FootStandingZone.RELEGATION_PLAYOFF;
            case 17, 18 -> FootStandingZone.RELEGATION;
            default -> null;
        };
    }
}
