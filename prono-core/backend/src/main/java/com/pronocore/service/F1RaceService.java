package com.pronocore.service;

import com.pronocore.dto.request.EnterRaceResultsRequest;
import com.pronocore.dto.request.F1PredictionRequest;
import com.pronocore.dto.response.*;
import com.pronocore.mapper.BetMapper;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import com.pronocore.service.f1.F1Scoring;
import com.pronocore.service.f1.F1ScoringService;
import com.pronocore.service.f1.F1StandingsService;
import com.pronocore.service.f1.RaceOutcome;
import com.pronocore.util.CurrentUserLookup;
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
 *
 * The scoring formula lives in {@link F1Scoring} / {@link F1ScoringService},
 * and championship standings in {@link F1StandingsService} — this class
 * covers races, opening bets and predictions only.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class F1RaceService {

    private final RaceRepository raceRepository;
    private final RaceResultRepository raceResultRepository;
    private final QualifyingResultRepository qualifyingResultRepository;
    private final DriverRepository driverRepository;
    private final F1PredictionRepository predictionRepository;
    private final BetRepository betRepository;
    private final BetParticipationRepository participationRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final GroupMemberGuard groupMemberGuard;
    private final CompetitionRepository competitionRepository;
    private final DailyGageService dailyGageService;
    private final BetMapper betMapper;
    private final F1ScoringService f1ScoringService;

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
    public DriverResponse getDriver(Long driverId) {
        return toDriverResponse(requireDriver(driverId));
    }

    /** A driver's results across the current season's finished races, most recent first. */
    @Transactional(readOnly = true)
    public List<DriverRaceResultResponse> getDriverRaceResults(Long driverId) {
        requireDriver(driverId);
        return competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)
                .map(c -> raceResultRepository.findByDriverIdAndCompetitionIdWithRace(driverId, c.getId()))
                .orElse(List.of())
                .stream()
                .map(this::toDriverRaceResultResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RaceResponse> getRaces(String username) {
        User user = CurrentUserLookup.require(userRepository, username);
        Set<Long> openRaceIds = betRepository.findRaceIdsWithBetsInUserGroups(user.getId());
        Set<Long> predictedRaceIds = participationRepository.findParticipatedRaceIdsByUserId(user.getId());
        Map<Long, Long> predictionCounts = predictionCountsByRace(user.getId());
        return raceRepository.findAllByOrderByRaceDateAsc().stream()
                .map(race -> {
                    RaceResponse r = toRaceResponse(race);
                    r.setOpenInUserGroups(openRaceIds.contains(race.getId()));
                    r.setUserPredicted(predictedRaceIds.contains(race.getId()));
                    r.setPredictionsCount(predictionCounts.getOrDefault(race.getId(), 0L));
                    return r;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public RaceResponse getRace(Long raceId, String username) {
        User user = CurrentUserLookup.require(userRepository, username);
        Race race = requireRace(raceId);
        RaceResponse response = toRaceResponse(race);
        response.setOpenInUserGroups(
                !betRepository.findByRaceIdInUserActiveGroups(raceId, user.getId()).isEmpty());
        response.setUserPredicted(
                !predictionRepository.findByRaceIdAndUserId(raceId, user.getId()).isEmpty());
        response.setPredictionsCount(
                predictionCountsByRace(user.getId()).getOrDefault(raceId, 0L));
        if (race.getStatus() == Race.Status.FINISHED) {
            response.setResults(raceResultRepository.findByRaceIdWithDrivers(raceId).stream()
                    .map(this::toResultResponse)
                    .toList());
        }
        if (!LocalDateTime.now().isBefore(race.getQualifyingDate())) {
            response.setQualifyingResults(qualifyingResultRepository.findByRaceIdWithDrivers(raceId).stream()
                    .map(this::toQualifyingResultResponse)
                    .toList());
        }
        return response;
    }

    /** The caller's prediction for a race (identical across their groups). */
    @Transactional(readOnly = true)
    public Optional<F1PredictionResponse> getMyPrediction(Long raceId, String username) {
        User user = CurrentUserLookup.require(userRepository, username);
        Race race = requireRace(raceId);
        return predictionRepository.findByRaceIdAndUserId(raceId, user.getId()).stream()
                .findFirst()
                .map(p -> toPredictionResponse(p, race));
    }

    /**
     * The group's predictions, revealed milestone by milestone: nothing before
     * qualifying; only the (frozen) pole picks between qualifying and the race;
     * everything once the race has started. A pick is only ever shown once it
     * can no longer be changed.
     */
    @Transactional(readOnly = true)
    public List<F1PredictionResponse> getRacePredictions(Long raceId, String username) {
        User user = CurrentUserLookup.require(userRepository, username);
        Race race = requireRace(raceId);
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(race.getQualifyingDate())) {
            throw new IllegalStateException("Les pronostics des autres joueurs sont cachés jusqu'aux qualifs");
        }
        boolean poleOnly = now.isBefore(race.getRaceDate());

        Set<Long> userGroupBetIds = betRepository.findByRaceIdInUserActiveGroups(raceId, user.getId())
                .stream().map(Bet::getId).collect(Collectors.toSet());
        RaceOutcome outcome = raceOutcomeIfFinished(race);
        return predictionRepository.findByRaceId(raceId).stream()
                .filter(p -> userGroupBetIds.contains(p.getParticipation().getBet().getId()))
                .collect(Collectors.toMap(
                        p -> p.getParticipation().getUser().getId(), p -> p, (a, b) -> a))
                .values().stream()
                .map(p -> {
                    F1PredictionResponse response = toPredictionResponse(p, race, outcome);
                    User author = p.getParticipation().getUser();
                    response.setUsername(author.getUsername());
                    response.setDisplayName(author.getDisplayName());
                    if (poleOnly) {
                        // Podium, meilleur tour and lanterne rouge stay editable until
                        // lights out — mask them so nobody can copy a rival's picks.
                        response.setP1(null);
                        response.setP2(null);
                        response.setP3(null);
                        response.setFastestLap(null);
                        response.setLastClassified(null);
                    }
                    return response;
                })
                .sorted(Comparator
                        .comparingInt((F1PredictionResponse r) -> -r.getPointsEarned())
                        .thenComparing(r -> r.getDisplayName() != null ? r.getDisplayName() : r.getUsername(),
                                String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private Map<Long, Long> predictionCountsByRace(Long userId) {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : participationRepository.countRacePredictionsInUserGroups(userId)) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    // ---------------------------------------------------------------
    // Opening races for betting (group admin)
    // ---------------------------------------------------------------

    @Transactional
    public BetResponse openRaceForBetting(Long groupId, Long raceId, String username) {
        User requester = CurrentUserLookup.require(userRepository, username);
        groupMemberGuard.requireGroupAdmin(groupId, requester.getId());
        Group group = requireF1Group(groupId);
        Race race = requireRace(raceId);

        assertNotStarted(race);
        if (betRepository.existsByRaceIdAndGroupId(raceId, groupId)) {
            throw new IllegalStateException("This race is already open for betting in this group");
        }
        Bet bet = betRepository.save(buildRaceBet(race, group, requester));
        return betMapper.toResponse(bet);
    }

    @Transactional
    public void closeRaceForBetting(Long groupId, Long raceId, String username) {
        User requester = CurrentUserLookup.require(userRepository, username);
        groupMemberGuard.requireGroupAdmin(groupId, requester.getId());

        for (Bet bet : betRepository.findByRaceIdAndGroupId(raceId, groupId)) {
            predictionRepository.deleteByBetId(bet.getId());
            participationRepository.deleteByBetId(bet.getId());
            betRepository.delete(bet);
        }
    }

    /** Open every race of an F1 competition in the group (idempotent). */
    @Transactional
    public List<BetResponse> openCompetitionRacesForBetting(Long groupId, Long competitionId, String username) {
        User requester = CurrentUserLookup.require(userRepository, username);
        groupMemberGuard.requireGroupAdmin(groupId, requester.getId());
        Group group = requireF1Group(groupId);

        Set<Long> alreadyOpen = betRepository.findRaceIdsWithBetsForGroup(groupId);
        LocalDateTime now = LocalDateTime.now();
        return raceRepository.findByCompetition_IdOrderByRaceDateAsc(competitionId).stream()
                .filter(race -> race.getStatus() != Race.Status.FINISHED && race.getRaceDate().isAfter(now))
                .filter(race -> !alreadyOpen.contains(race.getId()))
                .map(race -> betMapper.toResponse(betRepository.save(buildRaceBet(race, group, requester))))
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
        User user = CurrentUserLookup.require(userRepository, username);
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

            participation.setChosenOption(F1Scoring.summarize(prediction));
            participation = participationRepository.save(participation);
            prediction.setParticipation(participation);
            lastSaved = predictionRepository.save(prediction);
        }
        return toPredictionResponse(lastSaved, race);
    }

    /**
     * Refuses to delete a race once someone has actually predicted on it — merely being
     * opened for betting (a group admin's {@link #openRaceForBetting}) must not block
     * deletion, only real picks. Bets on the race carry no participation yet in that case,
     * so they're torn down along with the race (bets.race_id isn't ON DELETE CASCADE).
     */
    @Transactional
    public void deleteRace(Long raceId) {
        Race race = requireRace(raceId);
        if (participationRepository.existsByBetRaceId(raceId)) {
            throw new IllegalStateException(
                    "Impossible de supprimer : des pronostics existent déjà sur cette course");
        }
        betRepository.deleteAll(betRepository.findByRaceId(raceId));
        raceRepository.delete(race);
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

        // Sprint positions come from the jolpica sync; a manual (re-)entry without
        // them must not wipe the sprint points already stored for the weekend.
        Map<Long, Integer> storedSprintPositions = raceResultRepository.findByRaceIdWithDrivers(raceId).stream()
                .filter(rr -> rr.getSprintPosition() != null)
                .collect(Collectors.toMap(rr -> rr.getDriver().getId(), RaceResult::getSprintPosition));

        raceResultRepository.deleteByRaceId(raceId);
        raceResultRepository.flush();
        List<RaceResult> results = request.getResults().stream()
                .map(entry -> RaceResult.builder()
                        .race(race)
                        .driver(requireDriver(entry.getDriverId()))
                        .position(entry.getPosition())
                        .sprintPosition(entry.getSprintPosition() != null
                                ? entry.getSprintPosition()
                                : storedSprintPositions.get(entry.getDriverId()))
                        .pole(entry.isPole())
                        .fastestLap(entry.isFastestLap())
                        .dnf(entry.isDnf())
                        .time(entry.getTime())
                        .build())
                .toList();
        raceResultRepository.saveAll(results);

        race.setStatus(Race.Status.FINISHED);
        raceRepository.save(race);

        f1ScoringService.settleBetsForRace(race, results);
        // A race day is a gage day like any match day: once everything of the
        // day is finished, the group's daily gage is assigned to the day's loser.
        dailyGageService.onMatchSettled(race.getRaceDate().toLocalDate());
        return getRaceForAdmin(race);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private RaceResponse getRaceForAdmin(Race race) {
        RaceResponse response = toRaceResponse(race);
        response.setResults(raceResultRepository.findByRaceIdWithDrivers(race.getId()).stream()
                .map(this::toResultResponse)
                .toList());
        return response;
    }

    private QualifyingResultResponse toQualifyingResultResponse(QualifyingResult qr) {
        return QualifyingResultResponse.builder()
                .driver(toDriverResponse(qr.getDriver()))
                .position(qr.getPosition())
                .time(qr.getTime())
                .build();
    }

    private RaceResultResponse toResultResponse(RaceResult rr) {
        return RaceResultResponse.builder()
                .driver(toDriverResponse(rr.getDriver()))
                .position(rr.getPosition())
                .sprintPosition(rr.getSprintPosition())
                .pole(rr.isPole())
                .fastestLap(rr.isFastestLap())
                .dnf(rr.isDnf())
                .time(rr.getTime())
                .build();
    }

    private RaceResponse toRaceResponse(Race race) {
        return RaceResponse.builder()
                .id(race.getId())
                .round(race.getRound())
                .name(race.getName())
                .countryIso2(race.getCountryIso2())
                .circuit(race.getCircuit())
                .qualifyingDate(race.getQualifyingDate())
                .sprintDate(race.getSprintDate())
                .raceDate(race.getRaceDate())
                .status(race.getStatus())
                .competitionId(race.getCompetition().getId())
                .build();
    }

    private F1PredictionResponse toPredictionResponse(F1Prediction p, Race race) {
        return toPredictionResponse(p, race, raceOutcomeIfFinished(race));
    }

    private F1PredictionResponse toPredictionResponse(F1Prediction p, Race race, RaceOutcome outcome) {
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
                .grandChelem(outcome != null && F1Scoring.isGrandChelem(p, outcome))
                .poleLocked(!now.isBefore(race.getQualifyingDate()))
                .raceLocked(!now.isBefore(race.getRaceDate()))
                .build();
    }

    /** Race results, only once the race is settled — null beforehand (nothing to compute yet). */
    private RaceOutcome raceOutcomeIfFinished(Race race) {
        return race.getStatus() == Race.Status.FINISHED
                ? RaceOutcome.from(raceResultRepository.findByRaceIdWithDrivers(race.getId()))
                : null;
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

    private DriverRaceResultResponse toDriverRaceResultResponse(RaceResult rr) {
        Race race = rr.getRace();
        return DriverRaceResultResponse.builder()
                .raceId(race.getId())
                .raceName(race.getName())
                .round(race.getRound())
                .countryIso2(race.getCountryIso2())
                .raceDate(race.getRaceDate())
                .position(rr.getPosition())
                .sprintPosition(rr.getSprintPosition())
                .pole(rr.isPole())
                .fastestLap(rr.isFastestLap())
                .dnf(rr.isDnf())
                .points(F1StandingsService.fiaPoints(rr.getPosition()) + F1StandingsService.fiaSprintPoints(rr.getSprintPosition()))
                .build();
    }

    private void assertNotStarted(Race race) {
        if (race.getStatus() == Race.Status.FINISHED || !LocalDateTime.now().isBefore(race.getRaceDate())) {
            throw new IllegalStateException("Cette course est déjà partie ou terminée — impossible de l'ouvrir aux paris");
        }
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
