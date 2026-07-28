package com.pronocore.service.f1;

import com.pronocore.entity.Bet;
import com.pronocore.entity.BetParticipation;
import com.pronocore.entity.F1Prediction;
import com.pronocore.entity.Race;
import com.pronocore.entity.RaceResult;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.F1PredictionRepository;
import com.pronocore.util.BetSettlement;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/** Settles every bet of a race against its final results, using the "Podium +" formula. */
@Slf4j
@Service
@RequiredArgsConstructor
public class F1ScoringService {

    private final BetRepository betRepository;
    private final BetParticipationRepository participationRepository;
    private final F1PredictionRepository predictionRepository;

    /**
     * Writes pointsEarned on every participation of the race and validates its bets.
     * Re-entering results is allowed: points are recomputed and overwritten
     * (pointsEarned is absolute, never accumulated).
     */
    @Transactional
    public void settleBetsForRace(Race race, List<RaceResult> results) {
        RaceOutcome outcome = RaceOutcome.from(results);
        String winningOption = F1Scoring.summarizeOutcome(outcome, results);
        log.info("🏁 Settling race {} ({}) — winning option: {}", race.getId(), race.getName(), winningOption);

        List<Bet> bets = betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(race.getId(), Bet.Status.OPEN);
        bets = new ArrayList<>(bets);
        // Re-settlement: also refresh already validated bets (results correction).
        betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(race.getId(), Bet.Status.VALIDATED)
                .forEach(bets::add);

        // One query for every prediction of the race, instead of one per participation.
        Map<Long, F1Prediction> predictionByParticipation = predictionRepository.findByRaceId(race.getId()).stream()
                .collect(Collectors.toMap(pr -> pr.getParticipation().getId(), pr -> pr));

        BetSettlement.settle(bets, winningOption, betRepository, participationRepository,
                p -> Optional.ofNullable(predictionByParticipation.get(p.getId()))
                        .map(prediction -> F1Scoring.computePoints(prediction, outcome))
                        .orElse(0),
                (p, earned) -> log.info("  +{} pts → {} [group: {}]", earned, p.getUser().getUsername(),
                        p.getBet().getGroup() != null ? p.getBet().getGroup().getName() : "?"),
                (bet, participations) -> { });
    }
}
