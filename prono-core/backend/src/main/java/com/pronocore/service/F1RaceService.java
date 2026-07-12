package com.pronocore.service;

import com.pronocore.dto.request.EnterRaceResultsRequest;
import com.pronocore.dto.request.F1PredictionRequest;
import com.pronocore.dto.response.*;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * F1 "Podium +" predictions on top of the generic bets pipeline.
 *
 * A race opened for betting in a group is a regular Bet (race_id set,
 * type RACE_PICKS). A player's prediction is a regular BetParticipation
 * plus a structured F1Prediction payload. Settlement writes pointsEarned
 * on the participation, so leaderboard / daily gages / forfeits all work
 * without F1-specific code downstream.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class F1RaceService {

    private final RaceRepository raceRepository;
    private final RaceResultRepository raceResultRepository;
    private final DriverRepository driverRepository;
    private final F1PredictionRepository predictionRepository;
    private final BetRepository betRepository;
    private final BetParticipationRepository participationRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final GroupMemberGuard groupMemberGuard;
    private final CompetitionRepository competitionRepository;
    private final DailyGageService dailyGageService;

    // ---------------------------------------------------------------
    // Scoring constants — formule "Podium +" (additive, max 14)
    // ---------------------------------------------------------------

    static final int POINTS_P1_EXACT          = 3;
    static final int POINTS_P2_EXACT          = 2;
    static final int POINTS_P3_EXACT          = 2;
    static final int POINTS_PODIUM_WRONG_SLOT = 1;
    static final int POINTS_POLE              = 2;
    static final int POINTS_FASTEST_LAP       = 1;
    static final int POINTS_LAST_CLASSIFIED   = 2;
    static final int POINTS_GRAND_CHELEM      = 2;

    /** FIA points scale — drives the driver/constructor standings. */
    private static final int[] FIA_POINTS = {25, 18, 15, 12, 10, 8, 6, 4, 2, 1};

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DriverResponse> getDrivers() {
        return driverRepository.findAllActiveWithConstructor().stream()
                .map(this::toDriverResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RaceResponse> getRaces(String username) {
        User user = requireUser(username);
        Set<Long> openRaceIds = betRepository.findRaceIdsWithBetsInUserGroups(user.getId());
        Set<Long> predictedRaceIds = participationRepository.findParticipatedRaceIdsByUserId(user.getId());
        return raceRepository.findAllByOrderByRaceDateAsc().stream()
                .map(race -> {
                    RaceResponse r = toRaceResponse(race);
                    r.setOpenInUserGroups(openRaceIds.contains(race.getId()));
                    r.setUserPredicted(predictedRaceIds.contains(race.getId()));
                    return r;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public RaceResponse getRace(Long raceId, String username) {
        User user = requireUser(username);
        Race race = requireRace(raceId);
        RaceResponse response = toRaceResponse(race);
        response.setOpenInUserGroups(
                !betRepository.findByRaceIdInUserActiveGroups(raceId, user.getId()).isEmpty());
        response.setUserPredicted(
                !predictionRepository.findByRaceIdAndUserId(raceId, user.getId()).isEmpty());
        if (race.getStatus() == Race.Status.FINISHED) {
            response.setResults(raceResultRepository.findByRaceIdWithDrivers(raceId).stream()
                    .map(rr -> RaceResultResponse.builder()
                            .driver(toDriverResponse(rr.getDriver()))
                            .position(rr.getPosition())
                            .pole(rr.isPole())
                            .fastestLap(rr.isFastestLap())
                            .dnf(rr.isDnf())
                            .build())
                    .toList());
        }
        return response;
    }

    /** The caller's prediction for a race (identical across their groups). */
    @Transactional(readOnly = true)
    public Optional<F1PredictionResponse> getMyPrediction(Long raceId, String username) {
        User user = requireUser(username);
        Race race = requireRace(raceId);
        return predictionRepository.findByRaceIdAndUserId(raceId, user.getId()).stream()
                .findFirst()
                .map(p -> toPredictionResponse(p, race));
    }

    /** Everyone's predictions for a race — hidden until the race has started. */
    @Transactional(readOnly = true)
    public List<F1PredictionResponse> getRacePredictions(Long raceId, String username) {
        User user = requireUser(username);
        Race race = requireRace(raceId);
        if (LocalDateTime.now().isBefore(race.getRaceDate())) {
            throw new IllegalStateException("Les pronostics des autres joueurs sont cachés jusqu'au départ");
        }
        Set<Long> userGroupBetIds = betRepository.findByRaceIdInUserActiveGroups(raceId, user.getId())
                .stream().map(Bet::getId).collect(Collectors.toSet());
        return predictionRepository.findByRaceId(raceId).stream()
                .filter(p -> userGroupBetIds.contains(p.getParticipation().getBet().getId()))
                .collect(Collectors.toMap(
                        p -> p.getParticipation().getUser().getId(), p -> p, (a, b) -> a))
                .values().stream()
                .map(p -> toPredictionResponse(p, race))
                .toList();
    }

    // ---------------------------------------------------------------
    // Opening races for betting (group admin)
    // ---------------------------------------------------------------

    @Transactional
    public BetResponse openRaceForBetting(Long groupId, Long raceId, String username) {
        User requester = requireUser(username);
        groupMemberGuard.requireGroupAdmin(groupId, requester.getId());
        Group group = requireF1Group(groupId);
        Race race = requireRace(raceId);

        if (betRepository.existsByRaceIdAndGroupId(raceId, groupId)) {
            throw new IllegalStateException("This race is already open for betting in this group");
        }
        Bet bet = betRepository.save(buildRaceBet(race, group, requester));
        return toBetResponse(bet);
    }

    @Transactional
    public void closeRaceForBetting(Long groupId, Long raceId, String username) {
        User requester = requireUser(username);
        groupMemberGuard.requireGroupAdmin(groupId, requester.getId());

        for (Bet bet : betRepository.findByRaceIdAndGroupId(raceId, groupId)) {
            List<BetParticipation> participations = participationRepository.findByBetId(bet.getId());
            for (BetParticipation p : participations) {
                predictionRepository.findByParticipationId(p.getId())
                        .ifPresent(predictionRepository::delete);
            }
            participationRepository.deleteAll(participations);
            betRepository.delete(bet);
        }
    }

    /** Open every race of an F1 competition in the group (idempotent). */
    @Transactional
    public List<BetResponse> openCompetitionRacesForBetting(Long groupId, Long competitionId, String username) {
        User requester = requireUser(username);
        groupMemberGuard.requireGroupAdmin(groupId, requester.getId());
        Group group = requireF1Group(groupId);

        return raceRepository.findByCompetition_IdOrderByRaceDateAsc(competitionId).stream()
                .filter(race -> !betRepository.existsByRaceIdAndGroupId(race.getId(), groupId))
                .map(race -> toBetResponse(betRepository.save(buildRaceBet(race, group, requester))))
                .toList();
    }

    private Bet buildRaceBet(Race race, Group group, User creator) {
        return Bet.builder()
                .title(race.getName())
                .betType(Bet.BetType.RACE_PICKS)
                .points(14)                      // indicative: max of the Podium+ scale
                .deadline(race.getRaceDate())    // last picks lock at lights out
                .status(Bet.Status.OPEN)
                .creator(creator)
                .group(group)
                .race(race)
                .build();
    }

    private Group requireF1Group(Long groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + groupId));
        if (!group.getSports().contains(Sport.F1)) {
            throw new IllegalStateException("Ce groupe ne joue pas à la F1 — active le sport F1 dans les réglages du groupe");
        }
        return group;
    }

    // ---------------------------------------------------------------
    // Predictions (players)
    // ---------------------------------------------------------------

    /**
     * Upserts the caller's prediction on every open bet for this race across
     * their active groups (same UX as football: one submission, all groups).
     *
     * Double deadline:
     *  - after race start   → nothing can change;
     *  - after quali start  → the pole pick is frozen (existing kept, new ones null).
     */
    @Transactional
    public F1PredictionResponse predict(Long raceId, F1PredictionRequest request, String username) {
        User user = requireUser(username);
        Race race = requireRace(raceId);
        LocalDateTime now = LocalDateTime.now();

        if (!now.isBefore(race.getRaceDate())) {
            throw new IllegalStateException("La course a déjà commencé, les pronostics sont fermés");
        }
        boolean poleLocked = !now.isBefore(race.getQualifyingDate());

        Driver p1 = requireDriver(request.getP1DriverId());
        Driver p2 = requireDriver(request.getP2DriverId());
        Driver p3 = requireDriver(request.getP3DriverId());
        Driver fastestLap = request.getFastestLapDriverId() != null ? requireDriver(request.getFastestLapDriverId()) : null;
        Driver lastClassified = request.getLastClassifiedDriverId() != null ? requireDriver(request.getLastClassifiedDriverId()) : null;
        Driver requestedPole = request.getPoleDriverId() != null ? requireDriver(request.getPoleDriverId()) : null;

        Set<Long> podiumIds = new HashSet<>(List.of(p1.getId(), p2.getId(), p3.getId()));
        if (podiumIds.size() < 3) {
            throw new IllegalArgumentException("Le podium doit contenir trois pilotes différents");
        }
        if (lastClassified != null && podiumIds.contains(lastClassified.getId())) {
            throw new IllegalArgumentException("La lanterne rouge ne peut pas être sur ton podium");
        }

        List<Bet> openBets = betRepository.findByRaceIdInUserActiveGroups(raceId, user.getId()).stream()
                .filter(b -> b.getStatus() == Bet.Status.OPEN)
                .toList();
        if (openBets.isEmpty()) {
            throw new IllegalStateException("Cette course n'est ouverte aux paris dans aucun de tes groupes");
        }

        F1Prediction lastSaved = null;
        for (Bet bet : openBets) {
            BetParticipation participation = participationRepository
                    .findByBetIdAndUserId(bet.getId(), user.getId())
                    .orElseGet(() -> BetParticipation.builder().bet(bet).user(user).build());

            F1Prediction prediction = participation.getId() != null
                    ? predictionRepository.findByParticipationId(participation.getId()).orElse(null)
                    : null;
            // Pole freeze: keep the stored pick once qualifying has started.
            Driver pole = poleLocked
                    ? (prediction != null ? prediction.getPole() : null)
                    : requestedPole;

            if (prediction == null) {
                prediction = F1Prediction.builder().build();
            }
            prediction.setP1(p1);
            prediction.setP2(p2);
            prediction.setP3(p3);
            prediction.setPole(pole);
            prediction.setFastestLap(fastestLap);
            prediction.setLastClassified(lastClassified);

            participation.setChosenOption(summarize(prediction));
            participation = participationRepository.save(participation);
            prediction.setParticipation(participation);
            lastSaved = predictionRepository.save(prediction);
        }
        return toPredictionResponse(lastSaved, race);
    }

    // ---------------------------------------------------------------
    // Results & settlement (platform admin)
    // ---------------------------------------------------------------

    /**
     * Stores the full classification and settles every bet of the race.
     * Re-entering results is allowed: points are recomputed and overwritten
     * (pointsEarned is absolute, never accumulated).
     */
    @Transactional
    public RaceResponse enterResults(Long raceId, EnterRaceResultsRequest request) {
        Race race = requireRace(raceId);

        Set<Long> seenDrivers = new HashSet<>();
        Set<Integer> seenPositions = new HashSet<>();
        int poleCount = 0;
        for (EnterRaceResultsRequest.Entry entry : request.getResults()) {
            if (!seenDrivers.add(entry.getDriverId())) {
                throw new IllegalArgumentException("Duplicate driver in results: " + entry.getDriverId());
            }
            if (entry.getPosition() != null && !seenPositions.add(entry.getPosition())) {
                throw new IllegalArgumentException("Duplicate position in results: " + entry.getPosition());
            }
            if (entry.isPole()) poleCount++;
        }
        if (poleCount > 1) {
            throw new IllegalArgumentException("Only one driver can have pole position");
        }
        if (!seenPositions.containsAll(List.of(1, 2, 3))) {
            throw new IllegalArgumentException("Results must at least classify positions 1, 2 and 3");
        }

        raceResultRepository.deleteByRaceId(raceId);
        raceResultRepository.flush();
        List<RaceResult> results = request.getResults().stream()
                .map(entry -> RaceResult.builder()
                        .race(race)
                        .driver(requireDriver(entry.getDriverId()))
                        .position(entry.getPosition())
                        .pole(entry.isPole())
                        .fastestLap(entry.isFastestLap())
                        .dnf(entry.isDnf())
                        .build())
                .toList();
        raceResultRepository.saveAll(results);

        race.setStatus(Race.Status.FINISHED);
        raceRepository.save(race);

        settleBetsForRace(race, results);
        // A race day is a gage day like any match day: once everything of the
        // day is finished, the group's daily gage is assigned to the day's loser.
        dailyGageService.onMatchSettled(race.getRaceDate().toLocalDate());
        return getRaceForAdmin(race);
    }

    private void settleBetsForRace(Race race, List<RaceResult> results) {
        RaceOutcome outcome = RaceOutcome.from(results);
        String winningOption = summarizeOutcome(outcome, results);
        log.info("🏁 Settling race {} ({}) — winning option: {}", race.getId(), race.getName(), winningOption);

        List<Bet> bets = betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(race.getId(), Bet.Status.OPEN);
        bets = new ArrayList<>(bets);
        // Re-settlement: also refresh already validated bets (results correction).
        betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(race.getId(), Bet.Status.VALIDATED)
                .forEach(bets::add);

        for (Bet bet : bets) {
            for (BetParticipation p : participationRepository.findByBetId(bet.getId())) {
                int earned = predictionRepository.findByParticipationId(p.getId())
                        .map(prediction -> computePoints(prediction, outcome))
                        .orElse(0);
                p.setPointsEarned(earned);
                participationRepository.save(p);
                log.info("  +{} pts → {} [group: {}]", earned, p.getUser().getUsername(),
                        bet.getGroup() != null ? bet.getGroup().getName() : "?");
            }
            bet.setStatus(Bet.Status.VALIDATED);
            bet.setWinningOption(winningOption);
            betRepository.save(bet);
        }
    }

    /**
     * Formule "Podium +" — additive, max 14:
     *   P1/P2/P3 exact         → 3 / 2 / 2
     *   podium, wrong slot     → 1 per driver
     *   pole                   → 2
     *   fastest lap            → 1
     *   last classified        → 2
     *   grand chelem bonus     → 2 (pole + P1 + fastest lap all correct)
     */
    int computePoints(F1Prediction prediction, RaceOutcome outcome) {
        int points = 0;
        points += podiumPoints(prediction.getP1(), 1, POINTS_P1_EXACT, outcome);
        points += podiumPoints(prediction.getP2(), 2, POINTS_P2_EXACT, outcome);
        points += podiumPoints(prediction.getP3(), 3, POINTS_P3_EXACT, outcome);

        boolean poleCorrect = prediction.getPole() != null
                && Objects.equals(idOf(prediction.getPole()), outcome.poleDriverId());
        boolean fastestCorrect = prediction.getFastestLap() != null
                && Objects.equals(idOf(prediction.getFastestLap()), outcome.fastestLapDriverId());
        boolean p1Exact = Objects.equals(idOf(prediction.getP1()), outcome.driverAt(1));

        if (poleCorrect) points += POINTS_POLE;
        if (fastestCorrect) points += POINTS_FASTEST_LAP;
        if (prediction.getLastClassified() != null
                && Objects.equals(idOf(prediction.getLastClassified()), outcome.lastClassifiedDriverId())) {
            points += POINTS_LAST_CLASSIFIED;
        }
        if (poleCorrect && fastestCorrect && p1Exact) {
            points += POINTS_GRAND_CHELEM;
        }
        return points;
    }

    private int podiumPoints(Driver picked, int slot, int exactPoints, RaceOutcome outcome) {
        Long pickedId = idOf(picked);
        if (pickedId == null) return 0;
        if (Objects.equals(pickedId, outcome.driverAt(slot))) return exactPoints;
        return outcome.isOnPodium(pickedId) ? POINTS_PODIUM_WRONG_SLOT : 0;
    }

    private static Long idOf(Driver driver) {
        return driver != null ? driver.getId() : null;
    }

    /** Actual outcome of a race, extracted from its results. */
    record RaceOutcome(Map<Integer, Long> driverByPosition,
                       Long poleDriverId,
                       Long fastestLapDriverId,
                       Long lastClassifiedDriverId) {

        static RaceOutcome from(List<RaceResult> results) {
            Map<Integer, Long> byPosition = new HashMap<>();
            Long pole = null, fastest = null, last = null;
            int maxPosition = -1;
            for (RaceResult rr : results) {
                if (rr.getPosition() != null) {
                    byPosition.put(rr.getPosition(), rr.getDriver().getId());
                    if (rr.getPosition() > maxPosition) {
                        maxPosition = rr.getPosition();
                        last = rr.getDriver().getId();
                    }
                }
                if (rr.isPole()) pole = rr.getDriver().getId();
                if (rr.isFastestLap()) fastest = rr.getDriver().getId();
            }
            return new RaceOutcome(byPosition, pole, fastest, last);
        }

        Long driverAt(int position) { return driverByPosition.get(position); }

        boolean isOnPodium(Long driverId) {
            return Objects.equals(driverId, driverAt(1))
                    || Objects.equals(driverId, driverAt(2))
                    || Objects.equals(driverId, driverAt(3));
        }
    }

    // ---------------------------------------------------------------
    // Standings (computed from race results, FIA scale)
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<F1StandingResponse> getDriverStandings() {
        List<RaceResult> results = findSeasonResults();
        Map<Long, F1StandingResponse> byDriver = new LinkedHashMap<>();
        Map<Long, Integer> points = new HashMap<>();
        Map<Long, Integer> wins = new HashMap<>();
        Map<Long, Integer> podiums = new HashMap<>();

        for (RaceResult rr : results) {
            Long driverId = rr.getDriver().getId();
            byDriver.computeIfAbsent(driverId, id -> F1StandingResponse.builder()
                    .driver(toDriverResponse(rr.getDriver()))
                    .constructorId(rr.getDriver().getConstructor().getId())
                    .constructorName(rr.getDriver().getConstructor().getName())
                    .constructorColor(rr.getDriver().getConstructor().getColor())
                    .build());
            points.merge(driverId, fiaPoints(rr.getPosition()), Integer::sum);
            if (rr.getPosition() != null && rr.getPosition() == 1) wins.merge(driverId, 1, Integer::sum);
            if (rr.getPosition() != null && rr.getPosition() <= 3) podiums.merge(driverId, 1, Integer::sum);
        }
        return rank(byDriver, points, wins, podiums);
    }

    @Transactional(readOnly = true)
    public List<F1StandingResponse> getConstructorStandings() {
        List<RaceResult> results = findSeasonResults();
        Map<Long, F1StandingResponse> byConstructor = new LinkedHashMap<>();
        Map<Long, Integer> points = new HashMap<>();
        Map<Long, Integer> wins = new HashMap<>();
        Map<Long, Integer> podiums = new HashMap<>();

        for (RaceResult rr : results) {
            Constructor constructor = rr.getDriver().getConstructor();
            Long constructorId = constructor.getId();
            byConstructor.computeIfAbsent(constructorId, id -> F1StandingResponse.builder()
                    .constructorId(constructorId)
                    .constructorName(constructor.getName())
                    .constructorColor(constructor.getColor())
                    .build());
            points.merge(constructorId, fiaPoints(rr.getPosition()), Integer::sum);
            if (rr.getPosition() != null && rr.getPosition() == 1) wins.merge(constructorId, 1, Integer::sum);
            if (rr.getPosition() != null && rr.getPosition() <= 3) podiums.merge(constructorId, 1, Integer::sum);
        }
        return rank(byConstructor, points, wins, podiums);
    }

    private List<RaceResult> findSeasonResults() {
        return competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)
                .map(c -> raceResultRepository.findByCompetitionIdWithDrivers(c.getId()))
                .orElse(List.of());
    }

    private List<F1StandingResponse> rank(Map<Long, F1StandingResponse> entries,
                                          Map<Long, Integer> points,
                                          Map<Long, Integer> wins,
                                          Map<Long, Integer> podiums) {
        List<Map.Entry<Long, F1StandingResponse>> sorted = new ArrayList<>(entries.entrySet());
        sorted.sort(Comparator
                .comparingInt((Map.Entry<Long, F1StandingResponse> e) -> -points.getOrDefault(e.getKey(), 0))
                .thenComparingInt(e -> -wins.getOrDefault(e.getKey(), 0)));

        List<F1StandingResponse> standings = new ArrayList<>();
        int rank = 1;
        for (Map.Entry<Long, F1StandingResponse> entry : sorted) {
            F1StandingResponse row = entry.getValue();
            row.setRank(rank++);
            row.setPoints(points.getOrDefault(entry.getKey(), 0));
            row.setWins(wins.getOrDefault(entry.getKey(), 0));
            row.setPodiums(podiums.getOrDefault(entry.getKey(), 0));
            standings.add(row);
        }
        return standings;
    }

    static int fiaPoints(Integer position) {
        if (position == null || position < 1 || position > FIA_POINTS.length) return 0;
        return FIA_POINTS[position - 1];
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    /** "NOR · PIA · VER | pole NOR | mt HAM | der BOT" — human-readable summary. */
    private String summarize(F1Prediction p) {
        StringBuilder sb = new StringBuilder();
        sb.append(p.getP1().getCode()).append(" · ")
          .append(p.getP2().getCode()).append(" · ")
          .append(p.getP3().getCode());
        if (p.getPole() != null) sb.append(" | pole ").append(p.getPole().getCode());
        if (p.getFastestLap() != null) sb.append(" | mt ").append(p.getFastestLap().getCode());
        if (p.getLastClassified() != null) sb.append(" | der ").append(p.getLastClassified().getCode());
        return sb.toString();
    }

    private String summarizeOutcome(RaceOutcome outcome, List<RaceResult> results) {
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

    private RaceResponse getRaceForAdmin(Race race) {
        RaceResponse response = toRaceResponse(race);
        response.setResults(raceResultRepository.findByRaceIdWithDrivers(race.getId()).stream()
                .map(rr -> RaceResultResponse.builder()
                        .driver(toDriverResponse(rr.getDriver()))
                        .position(rr.getPosition())
                        .pole(rr.isPole())
                        .fastestLap(rr.isFastestLap())
                        .dnf(rr.isDnf())
                        .build())
                .toList());
        return response;
    }

    private RaceResponse toRaceResponse(Race race) {
        return RaceResponse.builder()
                .id(race.getId())
                .round(race.getRound())
                .name(race.getName())
                .countryIso2(race.getCountryIso2())
                .circuit(race.getCircuit())
                .qualifyingDate(race.getQualifyingDate())
                .raceDate(race.getRaceDate())
                .status(race.getStatus())
                .competitionId(race.getCompetition().getId())
                .build();
    }

    private F1PredictionResponse toPredictionResponse(F1Prediction p, Race race) {
        LocalDateTime now = LocalDateTime.now();
        return F1PredictionResponse.builder()
                .raceId(race.getId())
                .p1(toDriverResponse(p.getP1()))
                .p2(toDriverResponse(p.getP2()))
                .p3(toDriverResponse(p.getP3()))
                .pole(p.getPole() != null ? toDriverResponse(p.getPole()) : null)
                .fastestLap(p.getFastestLap() != null ? toDriverResponse(p.getFastestLap()) : null)
                .lastClassified(p.getLastClassified() != null ? toDriverResponse(p.getLastClassified()) : null)
                .pointsEarned(p.getParticipation() != null ? p.getParticipation().getPointsEarned() : 0)
                .poleLocked(!now.isBefore(race.getQualifyingDate()))
                .raceLocked(!now.isBefore(race.getRaceDate()))
                .build();
    }

    private DriverResponse toDriverResponse(Driver driver) {
        return DriverResponse.builder()
                .id(driver.getId())
                .name(driver.getName())
                .code(driver.getCode())
                .number(driver.getNumber())
                .constructorId(driver.getConstructor().getId())
                .constructorName(driver.getConstructor().getName())
                .constructorColor(driver.getConstructor().getColor())
                .build();
    }

    private BetResponse toBetResponse(Bet bet) {
        return BetResponse.builder()
                .id(bet.getId())
                .title(bet.getTitle())
                .betType(bet.getBetType())
                .points(bet.getPoints())
                .deadline(bet.getDeadline())
                .status(bet.getStatus())
                .groupId(bet.getGroup().getId())
                .raceId(bet.getRace() != null ? bet.getRace().getId() : null)
                .raceName(bet.getRace() != null ? bet.getRace().getName() : null)
                .build();
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
    }

    private Race requireRace(Long raceId) {
        return raceRepository.findById(raceId)
                .orElseThrow(() -> new EntityNotFoundException("Race not found: " + raceId));
    }

    private Driver requireDriver(Long driverId) {
        return driverRepository.findById(driverId)
                .orElseThrow(() -> new EntityNotFoundException("Driver not found: " + driverId));
    }
}
