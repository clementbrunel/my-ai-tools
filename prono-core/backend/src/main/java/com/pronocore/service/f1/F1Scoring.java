package com.pronocore.service.f1;

import com.pronocore.entity.Driver;
import com.pronocore.entity.F1Prediction;
import com.pronocore.entity.RaceResult;

import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.List;

/**
 * Pure "Podium +" scoring formula (additive, max 14):
 *   P1/P2/P3 exact         → 3 / 2 / 2
 *   podium, wrong slot     → 1 per driver
 *   pole                   → 2
 *   fastest lap            → 1
 *   last classified        → 2
 *   grand chelem bonus     → 2 (pole + P1 + fastest lap all correct)
 */
public final class F1Scoring {

    public static final int POINTS_P1_EXACT          = 3;
    public static final int POINTS_P2_EXACT          = 2;
    public static final int POINTS_P3_EXACT          = 2;
    public static final int POINTS_PODIUM_WRONG_SLOT = 1;
    public static final int POINTS_POLE              = 2;
    public static final int POINTS_FASTEST_LAP       = 1;
    public static final int POINTS_LAST_CLASSIFIED   = 2;
    public static final int POINTS_GRAND_CHELEM      = 2;

    private F1Scoring() {
    }

    public static int computePoints(F1Prediction prediction, RaceOutcome outcome) {
        int points = 0;
        points += podiumPoints(prediction.getP1(), 1, POINTS_P1_EXACT, outcome);
        points += podiumPoints(prediction.getP2(), 2, POINTS_P2_EXACT, outcome);
        points += podiumPoints(prediction.getP3(), 3, POINTS_P3_EXACT, outcome);

        boolean poleCorrect = prediction.getPole() != null
                && Objects.equals(idOf(prediction.getPole()), outcome.poleDriverId());
        boolean fastestCorrect = prediction.getFastestLap() != null
                && Objects.equals(idOf(prediction.getFastestLap()), outcome.fastestLapDriverId());

        if (poleCorrect) points += POINTS_POLE;
        if (fastestCorrect) points += POINTS_FASTEST_LAP;
        if (prediction.getLastClassified() != null
                && Objects.equals(idOf(prediction.getLastClassified()), outcome.lastClassifiedDriverId())) {
            points += POINTS_LAST_CLASSIFIED;
        }
        if (isGrandChelem(prediction, outcome)) {
            points += POINTS_GRAND_CHELEM;
        }
        return points;
    }

    /** Pole + P1 + fastest lap picks all correct (+2 bonus, see {@link #computePoints}). */
    public static boolean isGrandChelem(F1Prediction prediction, RaceOutcome outcome) {
        boolean poleCorrect = prediction.getPole() != null
                && Objects.equals(idOf(prediction.getPole()), outcome.poleDriverId());
        boolean fastestCorrect = prediction.getFastestLap() != null
                && Objects.equals(idOf(prediction.getFastestLap()), outcome.fastestLapDriverId());
        boolean p1Exact = Objects.equals(idOf(prediction.getP1()), outcome.driverAt(1));
        return poleCorrect && fastestCorrect && p1Exact;
    }

    private static int podiumPoints(Driver picked, int slot, int exactPoints, RaceOutcome outcome) {
        Long pickedId = idOf(picked);
        if (pickedId == null) return 0;
        if (Objects.equals(pickedId, outcome.driverAt(slot))) return exactPoints;
        return outcome.isOnPodium(pickedId) ? POINTS_PODIUM_WRONG_SLOT : 0;
    }

    private static Long idOf(Driver driver) {
        return driver != null ? driver.getId() : null;
    }

    /** "NOR · PIA · VER | pole NOR | mt HAM | der BOT" — human-readable summary of a prediction. */
    public static String summarize(F1Prediction p) {
        StringBuilder sb = new StringBuilder();
        sb.append(p.getP1().getCode()).append(" · ")
          .append(p.getP2().getCode()).append(" · ")
          .append(p.getP3().getCode());
        if (p.getPole() != null) sb.append(" | pole ").append(p.getPole().getCode());
        if (p.getFastestLap() != null) sb.append(" | mt ").append(p.getFastestLap().getCode());
        if (p.getLastClassified() != null) sb.append(" | der ").append(p.getLastClassified().getCode());
        return sb.toString();
    }

    /** Same summary, built from the actual race outcome — becomes the bet's winning option. */
    public static String summarizeOutcome(RaceOutcome outcome, List<RaceResult> results) {
        Map<Long, String> codeById = results.stream()
                .collect(Collectors.toMap(rr -> rr.getDriver().getId(), rr -> rr.getDriver().getCode()));
        StringBuilder sb = new StringBuilder();
        sb.append(codeById.getOrDefault(outcome.driverAt(1), "?")).append(" · ")
          .append(codeById.getOrDefault(outcome.driverAt(2), "?")).append(" · ")
          .append(codeById.getOrDefault(outcome.driverAt(3), "?"));
        if (outcome.poleDriverId() != null) sb.append(" | pole ").append(codeById.get(outcome.poleDriverId()));
        if (outcome.fastestLapDriverId() != null) sb.append(" | mt ").append(codeById.get(outcome.fastestLapDriverId()));
        if (outcome.lastClassifiedDriverId() != null) sb.append(" | der ").append(codeById.get(outcome.lastClassifiedDriverId()));
        return sb.toString();
    }
}
