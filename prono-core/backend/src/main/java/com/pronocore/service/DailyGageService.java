package com.pronocore.service;

import com.pronocore.dto.request.CreateDailyGageRequest;
import com.pronocore.entity.GroupMember;
import com.pronocore.dto.response.DailyGageCandidateResponse;
import com.pronocore.dto.response.DailyGageResponse;
import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import com.pronocore.service.email.EmailTheme;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DailyGageService {

    private final DailyGageRepository          dailyGageRepository;
    private final DailyGageCandidateRepository candidateRepository;
    private final DailyGageVoteRepository      voteRepository;
    private final ForfeitRepository            forfeitRepository;
    private final UserRepository               userRepository;
    private final UserForfeitRepository        userForfeitRepository;
    private final BetParticipationRepository   betParticipationRepository;
    private final BetRepository                betRepository;
    private final MatchRepository              matchRepository;
    private final RaceRepository               raceRepository;
    private final GroupRepository              groupRepository;
    private final GroupMemberRepository        groupMemberRepository;
    private final GroupMemberGuard             groupMemberGuard;
    private final EmailService                 emailService;

    // ---------------------------------------------------------------
    // Queries (scoped to the caller's groups)
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DailyGageResponse> getAllDailyGages() {
        User user = currentUserOrNull();
        if (user == null) return List.of();
        List<Long> groupIds = activeGroupIds(user.getId());
        if (groupIds.isEmpty()) return List.of();
        return toResponseList(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(groupIds), user);
    }

    @Transactional(readOnly = true)
    public List<DailyGageResponse> getDailyGagesByGroup(Long groupId) {
        User user = currentUser();
        groupMemberGuard.requireActiveMembership(groupId, user.getId());
        return toResponseList(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(List.of(groupId)), user);
    }

    @Transactional(readOnly = true)
    public List<DailyGageResponse> getDailyGagesByDate(LocalDate date) {
        User user = currentUserOrNull();
        if (user == null) return List.of();
        List<Long> groupIds = activeGroupIds(user.getId());
        if (groupIds.isEmpty()) return List.of();
        return toResponseList(dailyGageRepository.findByMatchDateAndGroupIdIn(date, groupIds), user);
    }

    @Transactional(readOnly = true)
    public DailyGageResponse getDailyGageById(Long id) {
        User user = currentUser();
        DailyGage dg = requireDailyGage(id);
        groupMemberGuard.requireActiveMembership(dg.getGroup().getId(), user.getId());
        return toResponse(dg, user);
    }

    // ---------------------------------------------------------------
    // Group-admin commands
    // ---------------------------------------------------------------

    @Transactional
    public DailyGageResponse createDailyGage(CreateDailyGageRequest req) {
        User user = currentUser();
        groupMemberGuard.requireGroupAdmin(req.getGroupId(), user.getId());

        Group group = groupRepository.findById(req.getGroupId())
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + req.getGroupId()));

        if (dailyGageRepository.findByGroupIdAndMatchDate(req.getGroupId(), req.getMatchDate()).isPresent()) {
            throw new IllegalStateException("A daily gage already exists for " + req.getMatchDate() + " in this group");
        }
        // Guard: at least one bet must be open for this group on that day
        LocalDateTime startOfDay = req.getMatchDate().atStartOfDay();
        LocalDateTime endOfDay   = req.getMatchDate().plusDays(1).atStartOfDay();
        if (!betRepository.existsOpenBetForGroupOnDay(req.getGroupId(), startOfDay, endOfDay)) {
            throw new IllegalArgumentException(
                    "Aucun pari ouvert le " + req.getMatchDate()
                    + " dans ce groupe — ouvrez d'abord les paris sur les matchs ou courses de cette journée.");
        }
        DailyGage dg = DailyGage.builder()
                .group(group)
                .matchDate(req.getMatchDate())
                .mode(req.getMode())
                .status(DailyGage.Status.PENDING)
                .build();
        dg = dailyGageRepository.save(dg);
        log.info("📅 Daily gage created for {} [{}] in group {}",
                req.getMatchDate(), req.getMode(), group.getName());
        return toResponse(dg, user);
    }

    /** DIRECT mode: group admin picks the forfeit → status becomes ACTIVE. */
    @Transactional
    public DailyGageResponse selectForfeitDirectly(Long dailyGageId, Long forfeitId) {
        User user = currentUser();
        DailyGage dg = requireDailyGage(dailyGageId);
        groupMemberGuard.requireGroupAdmin(dg.getGroup().getId(), user.getId());
        if (dg.getStatus() == DailyGage.Status.SETTLED) {
            throw new IllegalStateException("Daily gage is already settled");
        }
        Forfeit forfeit = requireForfeit(forfeitId);
        dg.setForfeit(forfeit);
        dg.setStatus(DailyGage.Status.ACTIVE);
        dailyGageRepository.save(dg);
        log.info("✅ Forfeit '{}' selected directly for {}", forfeit.getTitle(), dg.getMatchDate());
        return toResponse(dg, user);
    }

    /** VOTE mode: add a candidate forfeit to the pool. */
    @Transactional
    public DailyGageResponse addCandidate(Long dailyGageId, Long forfeitId) {
        User user = currentUser();
        DailyGage dg = requireDailyGage(dailyGageId);
        groupMemberGuard.requireGroupAdmin(dg.getGroup().getId(), user.getId());
        if (dg.getStatus() == DailyGage.Status.SETTLED) {
            throw new IllegalStateException("Daily gage is already settled");
        }
        if (candidateRepository.findByDailyGageIdAndForfeitId(dailyGageId, forfeitId).isPresent()) {
            throw new IllegalStateException("Forfeit already a candidate for this day");
        }
        Forfeit forfeit = requireForfeit(forfeitId);
        DailyGageCandidate c = DailyGageCandidate.builder()
                .dailyGage(dg)
                .forfeit(forfeit)
                .build();
        candidateRepository.save(c);
        // Auto-activate if first candidate added in VOTE mode
        if (dg.getStatus() == DailyGage.Status.PENDING) {
            dg.setStatus(DailyGage.Status.ACTIVE);
            dailyGageRepository.save(dg);
        }
        return toResponse(requireDailyGage(dailyGageId), user);
    }

    /** Delete a daily gage entirely (must not be SETTLED). */
    @Transactional
    public void deleteDailyGage(Long dailyGageId) {
        User user = currentUser();
        DailyGage dg = requireDailyGage(dailyGageId);
        groupMemberGuard.requireGroupAdmin(dg.getGroup().getId(), user.getId());
        if (dg.getStatus() == DailyGage.Status.SETTLED) {
            throw new IllegalStateException("Cannot delete a settled daily gage");
        }
        dailyGageRepository.delete(dg);
        log.info("🗑️ Daily gage {} ({}) deleted by {}", dailyGageId, dg.getMatchDate(), user.getUsername());
    }

    /** VOTE mode: remove a candidate. */
    @Transactional
    public DailyGageResponse removeCandidate(Long dailyGageId, Long forfeitId) {
        User user = currentUser();
        DailyGage dg = requireDailyGage(dailyGageId);
        groupMemberGuard.requireGroupAdmin(dg.getGroup().getId(), user.getId());
        DailyGageCandidate c = candidateRepository
                .findByDailyGageIdAndForfeitId(dailyGageId, forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Candidate not found"));
        // Retirer de la collection parente pour que orphanRemoval déclenche la suppression.
        // Appeler candidateRepository.delete() directement échoue silencieusement car
        // Hibernate voit encore le candidat dans dg.candidates au flush.
        dg.getCandidates().remove(c);
        if (dg.getCandidates().isEmpty() && dg.getStatus() == DailyGage.Status.ACTIVE) {
            dg.setStatus(DailyGage.Status.PENDING);
        }
        dailyGageRepository.save(dg);
        return toResponse(dg, user);
    }

    // ---------------------------------------------------------------
    // Player vote (group members)
    // ---------------------------------------------------------------

    /**
     * Cast or change a vote (+1 / -1) on a candidate.
     * Pass vote=0 to remove the vote.
     */
    @Transactional
    public DailyGageResponse vote(Long dailyGageId, Long forfeitId, int voteValue) {
        User user = currentUser();
        DailyGage dg = requireDailyGage(dailyGageId);
        groupMemberGuard.requireActiveMembership(dg.getGroup().getId(), user.getId());
        if (dg.getStatus() == DailyGage.Status.SETTLED) {
            throw new IllegalStateException("Voting is closed — gage already settled");
        }
        if (dg.getMode() != DailyGage.Mode.VOTE) {
            throw new IllegalStateException("This daily gage is not in VOTE mode");
        }
        DailyGageCandidate candidate = candidateRepository
                .findByDailyGageIdAndForfeitId(dailyGageId, forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Candidate not found"));

        Optional<DailyGageVote> existing = voteRepository.findByCandidateIdAndUserId(candidate.getId(), user.getId());

        if (voteValue == 0) {
            existing.ifPresent(voteRepository::delete);
        } else {
            if (existing.isPresent()) {
                existing.get().setVote(voteValue);
                voteRepository.save(existing.get());
            } else {
                DailyGageVote v = DailyGageVote.builder()
                        .candidate(candidate)
                        .user(user)
                        .vote(voteValue)
                        .build();
                voteRepository.save(v);
            }
        }
        return toResponse(requireDailyGage(dailyGageId), user);
    }

    // ---------------------------------------------------------------
    // Auto-settlement (called by MatchService)
    // ---------------------------------------------------------------

    /**
     * Called after every match or F1 race settlement. Once every event of the
     * calendar day (matches AND races) is FINISHED, each group's daily gage for
     * that day is assigned to the group member who earned the fewest points
     * among that group's participations (football and F1 points combined).
     */
    @Transactional
    public void onMatchSettled(LocalDate matchDay) {
        LocalDateTime startOfDay = matchDay.atStartOfDay();
        LocalDateTime endOfDay   = matchDay.plusDays(1).atStartOfDay();

        long unfinished = matchRepository.countUnfinishedMatchesOnDay(startOfDay, endOfDay, Match.Status.FINISHED)
                        + raceRepository.countUnfinishedRacesOnDay(startOfDay, endOfDay);
        if (unfinished > 0) {
            log.debug("⏳ {} event(s) still unfinished on {} — gage deferred", unfinished, matchDay);
            return;
        }

        List<DailyGage> gages = dailyGageRepository.findByMatchDate(matchDay);
        if (gages.isEmpty()) {
            log.debug("No daily gage configured for {}", matchDay);
            return;
        }
        for (DailyGage dg : gages) {
            settleGage(dg, startOfDay, endOfDay, matchDay);
        }
    }

    private void settleGage(DailyGage dg, LocalDateTime startOfDay, LocalDateTime endOfDay, LocalDate matchDay) {
        if (dg.getStatus() == DailyGage.Status.SETTLED) return;
        Long groupId = dg.getGroup().getId();

        // Determine the forfeit to assign
        Forfeit forfeit = dg.getForfeit();
        if (forfeit == null) {
            if (dg.getMode() == DailyGage.Mode.VOTE) {
                forfeit = selectWinnerByVotes(dg);
                if (forfeit == null) {
                    log.warn("⚠️ VOTE mode daily gage {} ({}) has no candidates — skipping", dg.getId(), matchDay);
                    return;
                }
            } else {
                log.warn("⚠️ DIRECT mode daily gage {} ({}) has no forfeit selected — skipping", dg.getId(), matchDay);
                return;
            }
        }

        // Only members who actually placed a bet are in the gage pool (non-bettors are excluded).
        List<BetParticipation> participations = betParticipationRepository
                .findSettledByMatchDayAndGroup(startOfDay, endOfDay, Bet.Status.VALIDATED, groupId);
        if (participations.isEmpty()) {
            log.warn("⚠️ No settled participations for group {} on {} — cannot assign daily gage", groupId, matchDay);
            return;
        }

        Map<User, Integer> dailyPoints = participations.stream()
                .collect(Collectors.groupingBy(
                        BetParticipation::getUser,
                        Collectors.summingInt(BetParticipation::getPointsEarned)));

        // Detailed log so gage resolution is auditable
        log.info("📊 Gage settlement — group {} on {} ({} bettor(s)):", groupId, matchDay, dailyPoints.size());
        dailyPoints.forEach((user, pts) ->
                log.info("  {} → {} pts", user.getUsername(), pts));

        int minPoints = Collections.min(dailyPoints.values());
        List<User> losers = dailyPoints.entrySet().stream()
                .filter(e -> e.getValue() == minPoints)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        log.info("  → min={} pts | {} loser(s) in pool: {}",
                minPoints, losers.size(),
                losers.stream().map(User::getUsername).collect(Collectors.joining(", ")));

        User unlucky = losers.get(new Random().nextInt(losers.size()));
        User assignedBy = groupAdminOf(groupId).orElse(unlucky);

        UserForfeit uf = UserForfeit.builder()
                .user(unlucky)
                .forfeit(forfeit)
                .assignedBy(assignedBy)
                .group(dg.getGroup())
                .completed(false)
                .build();
        userForfeitRepository.save(uf);

        dg.setForfeit(forfeit);
        dg.setAssignedTo(unlucky);
        dg.setAssignedAt(LocalDateTime.now());
        dg.setStatus(DailyGage.Status.SETTLED);
        dailyGageRepository.save(dg);

        log.info("🃏 Daily gage '{}' assigned to {} (group {}) for {} ({} pts, {} loser(s) in draw)",
                forfeit.getTitle(), unlucky.getUsername(), groupId, matchDay, minPoints, losers.size());

        // Send gage resolution email to subscribed group members
        final Forfeit resolvedForfeit = forfeit;
        final User resolvedUnlucky = unlucky;
        Map<String, Integer> namedScores = dailyPoints.entrySet().stream()
                .collect(Collectors.toMap(
                        e -> e.getKey().getDisplayName() != null ? e.getKey().getDisplayName() : e.getKey().getUsername(),
                        Map.Entry::getValue));
        String groupName = dg.getGroup().getName();
        GageDayContext dayContext = contextForGageDay(participations);

        groupMemberRepository.findByGroupId(groupId).stream()
                .filter(m -> m.getStatus() == GroupMember.MemberStatus.ACTIVE)
                .map(GroupMember::getUser)
                .filter(User::isEmailGageEnabled)
                .forEach(subscriber -> emailService.sendGageResolutionEmail(
                        subscriber, resolvedForfeit.getTitle(), resolvedForfeit.getDescription(),
                        resolvedUnlucky, groupName, namedScores, dayContext.theme(), dayContext.dayLabel()));
    }

    private record GageDayContext(EmailTheme theme, String dayLabel) {
    }

    /**
     * The gage email's theme and wording reflect what was actually resolved that day: a pure
     * foot day talks about "matchs" and gets the foot palette, a pure F1 day talks about
     * "Grand Prix" and gets the F1 palette, and a mixed group (or an ambiguous/empty case)
     * falls back to sport-neutral wording and palette rather than favoring one sport.
     */
    private GageDayContext contextForGageDay(List<BetParticipation> participations) {
        boolean hasFoot = participations.stream().anyMatch(p -> p.getBet() != null && p.getBet().getMatch() != null);
        boolean hasF1 = participations.stream().anyMatch(p -> p.getBet() != null && p.getBet().getRace() != null);
        if (hasFoot && !hasF1) return new GageDayContext(EmailTheme.FOOTBALL, "de matchs");
        if (hasF1 && !hasFoot) return new GageDayContext(EmailTheme.F1, "de Grand Prix");
        return new GageDayContext(EmailTheme.NEUTRAL, "de pronostics");
    }

    // ---------------------------------------------------------------
    // Force-settle (admin, after-the-fact)
    // ---------------------------------------------------------------

    /**
     * Manually triggers gage settlement for an ACTIVE gage whose day's matches are all finished.
     * Used when the admin configured the gage after the last match was already resolved.
     */
    @Transactional
    public DailyGageResponse forceSettle(Long id) {
        User user = currentUser();
        DailyGage dg = requireDailyGage(id);
        groupMemberGuard.requireGroupAdmin(dg.getGroup().getId(), user.getId());

        if (dg.getStatus() == DailyGage.Status.SETTLED) {
            throw new IllegalStateException("Daily gage is already settled");
        }
        if (dg.getStatus() != DailyGage.Status.ACTIVE) {
            throw new IllegalStateException(
                    "Le gage doit être configuré (ACTIVE) avant de pouvoir forcer l'attribution");
        }

        LocalDate matchDay = dg.getMatchDate();
        LocalDateTime startOfDay = matchDay.atStartOfDay();
        LocalDateTime endOfDay   = matchDay.plusDays(1).atStartOfDay();

        long unfinished = matchRepository.countUnfinishedMatchesOnDay(startOfDay, endOfDay, Match.Status.FINISHED)
                        + raceRepository.countUnfinishedRacesOnDay(startOfDay, endOfDay);
        if (unfinished > 0) {
            throw new IllegalStateException(
                    unfinished + " match(s) ou course(s) non terminé(s) ce jour-là — impossible de forcer l'attribution");
        }

        settleGage(dg, startOfDay, endOfDay, matchDay);

        return toResponse(requireDailyGage(id), user);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private boolean allMatchesFinishedOnDay(LocalDate date) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end   = date.plusDays(1).atStartOfDay();
        return matchRepository.countUnfinishedMatchesOnDay(start, end, Match.Status.FINISHED) == 0
            && raceRepository.countUnfinishedRacesOnDay(start, end) == 0;
    }

    private Forfeit selectWinnerByVotes(DailyGage dg) {
        return dg.getCandidates().stream()
                .max(Comparator.comparingInt(DailyGageCandidate::getVoteScore))
                .map(DailyGageCandidate::getForfeit)
                .orElse(null);
    }

    private Optional<User> groupAdminOf(Long groupId) {
        return groupMemberRepository.findByGroupId(groupId).stream()
                .filter(m -> m.getRole() == GroupMember.GroupRole.GROUP_ADMIN
                          && m.getStatus() == GroupMember.MemberStatus.ACTIVE)
                .map(GroupMember::getUser)
                .findFirst();
    }

    private DailyGage requireDailyGage(Long id) {
        return dailyGageRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new EntityNotFoundException("DailyGage not found: " + id));
    }

    private Forfeit requireForfeit(Long id) {
        return forfeitRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Forfeit not found: " + id));
    }

    private List<Long> activeGroupIds(Long userId) {
        return groupMemberRepository.findByUserIdAndStatus(userId, GroupMember.MemberStatus.ACTIVE).stream()
                .map(m -> m.getGroup().getId())
                .toList();
    }

    private User currentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
    }

    private User currentUserOrNull() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        return userRepository.findByUsername(auth.getName()).orElse(null);
    }

    // ---------------------------------------------------------------
    // Mapping
    // ---------------------------------------------------------------

    /**
     * Maps a whole list of gages in one shot: batches vote lookups for every candidate
     * across all gages, and the "all matches finished that day" check per distinct date,
     * instead of issuing per-gage queries (the previous source of N+1 slowness).
     */
    private List<DailyGageResponse> toResponseList(List<DailyGage> gages, User user) {
        if (gages.isEmpty()) return List.of();

        List<Long> allCandidateIds = gages.stream()
                .flatMap(dg -> dg.getCandidates().stream())
                .map(DailyGageCandidate::getId)
                .toList();
        Map<Long, List<DailyGageVote>> votesByCandidate = allCandidateIds.isEmpty()
                ? Map.of()
                : voteRepository.findByCandidateIdIn(allCandidateIds).stream()
                        .collect(Collectors.groupingBy(v -> v.getCandidate().getId()));

        Map<LocalDate, Boolean> finishedByDay = computeFinishedByDay(gages);

        return gages.stream()
                .map(dg -> toResponse(dg, user, votesByCandidate, finishedByDay))
                .toList();
    }

    /** For every distinct gage day, whether all of that calendar day's events
     *  (matches and F1 races) are FINISHED — computed with two ranged queries
     *  instead of one COUNT query per gage. */
    private Map<LocalDate, Boolean> computeFinishedByDay(List<DailyGage> gages) {
        List<LocalDate> dates = gages.stream().map(DailyGage::getMatchDate).distinct().toList();
        if (dates.isEmpty()) return Map.of();

        LocalDate min = Collections.min(dates);
        LocalDate max = Collections.max(dates);
        Map<LocalDate, Long> unfinishedCountByDay = new HashMap<>();
        matchRepository.findMatchDatesAndStatusesInRange(
                        min.atStartOfDay(), max.plusDays(1).atStartOfDay()).stream()
                .filter(r -> r[1] != Match.Status.FINISHED)
                .forEach(r -> unfinishedCountByDay.merge(((LocalDateTime) r[0]).toLocalDate(), 1L, Long::sum));
        raceRepository.findRaceDatesAndStatusesInRange(
                        min.atStartOfDay(), max.plusDays(1).atStartOfDay()).stream()
                .filter(r -> r[1] != Race.Status.FINISHED)
                .forEach(r -> unfinishedCountByDay.merge(((LocalDateTime) r[0]).toLocalDate(), 1L, Long::sum));

        Map<LocalDate, Boolean> result = new HashMap<>();
        for (LocalDate d : dates) {
            result.put(d, unfinishedCountByDay.getOrDefault(d, 0L) == 0);
        }
        return result;
    }

    private DailyGageResponse toResponse(DailyGage dg, User currentUser) {
        return toResponse(dg, currentUser, null, null);
    }

    private DailyGageResponse toResponse(DailyGage dg, User currentUser,
                                          Map<Long, List<DailyGageVote>> votesByCandidate,
                                          Map<LocalDate, Boolean> finishedByDayMap) {
        Long currentUserId = currentUser != null ? currentUser.getId() : null;

        List<DailyGageCandidate> candidates = dg.getCandidates();
        // Votes are either taken from the pre-batched map (list endpoints) or fetched
        // in a single query scoped to this gage's own candidates (single-gage endpoints).
        Map<Long, Integer> userVoteByCandidate = Map.of();
        Map<Long, Integer> voteScoreByCandidate = Map.of();
        if (!candidates.isEmpty()) {
            List<Long> candidateIds = candidates.stream().map(DailyGageCandidate::getId).toList();
            List<DailyGageVote> allVotes = votesByCandidate != null
                    ? candidateIds.stream()
                            .flatMap(id -> votesByCandidate.getOrDefault(id, List.of()).stream())
                            .toList()
                    : voteRepository.findByCandidateIdIn(candidateIds);
            voteScoreByCandidate = allVotes.stream()
                    .collect(Collectors.groupingBy(
                            v -> v.getCandidate().getId(),
                            Collectors.summingInt(DailyGageVote::getVote)));
            if (currentUserId != null) {
                userVoteByCandidate = allVotes.stream()
                        .filter(v -> v.getUser().getId().equals(currentUserId))
                        .collect(Collectors.toMap(v -> v.getCandidate().getId(), DailyGageVote::getVote));
            }
        }

        final Map<Long, Integer> finalScores = voteScoreByCandidate;
        final Map<Long, Integer> finalUserVotes = userVoteByCandidate;

        List<DailyGageCandidateResponse> candidateResponses = candidates.stream()
                .map(c -> DailyGageCandidateResponse.builder()
                        .id(c.getId())
                        .forfeit(toForfeitResponse(c.getForfeit()))
                        .voteScore(finalScores.getOrDefault(c.getId(), 0))
                        .userVote(finalUserVotes.getOrDefault(c.getId(), 0))
                        .build())
                .toList();

        boolean canForceSettle = dg.getStatus() == DailyGage.Status.ACTIVE
                && (finishedByDayMap != null
                        ? finishedByDayMap.getOrDefault(dg.getMatchDate(), false)
                        : allMatchesFinishedOnDay(dg.getMatchDate()));

        return DailyGageResponse.builder()
                .id(dg.getId())
                .groupId(dg.getGroup().getId())
                .groupName(dg.getGroup().getName())
                .matchDate(dg.getMatchDate())
                .forfeit(dg.getForfeit() != null ? toForfeitResponse(dg.getForfeit()) : null)
                .mode(dg.getMode().name())
                .status(dg.getStatus().name())
                .assignedToUsername(dg.getAssignedTo() != null ? dg.getAssignedTo().getUsername() : null)
                .assignedToDisplayName(dg.getAssignedTo() != null ? dg.getAssignedTo().getDisplayName() : null)
                .assignedAt(dg.getAssignedAt())
                .candidates(candidateResponses)
                .createdAt(dg.getCreatedAt())
                .canForceSettle(canForceSettle)
                .build();
    }

    private ForfeitResponse toForfeitResponse(Forfeit f) {
        return ForfeitResponse.builder()
                .id(f.getId())
                .title(f.getTitle())
                .description(f.getDescription())
                .category(f.getCategory())
                .isActive(f.isActive())
                .timesCompleted(f.getTimesCompleted())
                .proposedByUsername(f.getProposedBy() != null ? f.getProposedBy().getUsername() : null)
                .proposedByDisplayName(f.getProposedBy() != null ? f.getProposedBy().getDisplayName() : null)
                .groupId(f.getGroup() != null ? f.getGroup().getId() : null)
                .groupName(f.getGroup() != null ? f.getGroup().getName() : null)
                .build();
    }
}
