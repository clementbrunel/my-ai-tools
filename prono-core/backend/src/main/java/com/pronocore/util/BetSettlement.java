package com.pronocore.util;

import com.pronocore.entity.Bet;
import com.pronocore.entity.BetParticipation;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.BetRepository;

import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Function;

/**
 * Shared core of both settlement flows (football matches and F1 races): for each bet,
 * score every participation with the sport-specific scorer, persist pointsEarned, then
 * validate the bet. Sport-specific behavior (which bets to fetch, how to log) stays with
 * the caller via the two callbacks — this only factors out the identical loop/persist shape.
 */
public final class BetSettlement {

    private BetSettlement() {
    }

    public static void settle(List<Bet> bets,
                               String winningOption,
                               BetRepository betRepository,
                               BetParticipationRepository participationRepository,
                               Function<BetParticipation, Integer> scorer,
                               BiConsumer<BetParticipation, Integer> onParticipationScored,
                               BiConsumer<Bet, List<BetParticipation>> onBetValidated) {
        for (Bet bet : bets) {
            List<BetParticipation> participations = participationRepository.findByBetId(bet.getId());
            for (BetParticipation p : participations) {
                int earned = scorer.apply(p);
                p.setPointsEarned(earned);
                participationRepository.save(p);
                onParticipationScored.accept(p, earned);
            }
            bet.setStatus(Bet.Status.VALIDATED);
            bet.setWinningOption(winningOption);
            betRepository.save(bet);
            onBetValidated.accept(bet, participations);
        }
    }
}
