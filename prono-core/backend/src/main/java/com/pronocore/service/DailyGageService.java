package com.pronocore.service;

import com.pronocore.dto.request.CreateDailyGageRequest;
import com.pronocore.dto.response.DailyGageCandidateResponse;
import com.pronocore.dto.response.DailyGageResponse;
import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
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
    private final GroupRepository              groupRepository;
    private final GroupMemberRepository        groupMemberRepository;
    private final GroupMemberGuard             groupMemberGuard;

    // ---------------------------------------------------------------
    // Queries (scoped to the caller's groups)
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DailyGageResponse> getAllDailyGages() {
        User user = currentUserOrNull();
        if (user == null) return List.of();
        List<Long> groupIds = activeGroupIds(user.getId());
        if (groupIds.isEmpty()) return List.of();
        return dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(groupIds).stream()
                .map(dg -> toResponse(dg, user))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DailyGageResponse> getDailyGagesByGroup(Long groupId) {
        User user = currentUser();
        groupMemberGuard.requireActiveMembership(groupId, user.getId());
        return dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(List.of(groupId)).stream()
                .map(dg -> toResponse(dg, user))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DailyGageResponse> getDailyGagesByDate(LocalDate date) {
        User user = currentUserOrNull();
        if (user == null) return List.of();
        List<Long> groupIds = activeGroupIds(user.getId());
        if (groupIds.isEmpty()) return List.of();
        return dailyGageRepository.findByMatchDateAndGroupIdIn(date, groupIds).stream()
                .map(dg -> toResponse(dg, user))
                .toList();
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
                    + " dans ce groupe — ouvrez d'abord les paris sur les matchs de cette journée.");
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
        return toResponse(dailyGageRepository.findById(dailyGageId).orElseThrow(), user);
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
        return toResponse(dailyGageRepository.findById(dailyGageId).orElseThrow(), user);
    }

    // ---------------------------------------------------------------
    // Auto-settlement (called by MatchService)
    // ---------------------------------------------------------------

    /**
     * Called after every match settlement. Once all matches of the calendar day
     * are FINISHED, each group's daily gage for that day is assigned to the group
     * member who earned the fewest points among that group's participations.
     */
    @Transactional
    public void onMatchSettled(LocalDate matchDay) {
        LocalDateTime startOfDay = matchDay.atStartOfDay();
        LocalDateTime endOfDay   = matchDay.plusDays(1).atStartOfDay();

        long unfinished = matchRepository.countUnfinishedMatchesOnDay(startOfDay, endOfDay, Match.Status.FINISHED);
        if (unfinished > 0) {
            log.debug("⏳ {} match(es) still unfinished on {} — gage deferred", unfinished, matchDay);
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

        // Per-player daily points among THIS group's settled participations
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

        int minPoints = Collections.min(dailyPoints.values());
        List<User> losers = dailyPoints.entrySet().stream()
                .filter(e -> e.getValue() == minPoints)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

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

        unlucky.setForfeitsReceived(unlucky.getForfeitsReceived() + 1);
        userRepository.save(unlucky);

        dg.setForfeit(forfeit);
        dg.setAssignedTo(unlucky);
        dg.setAssignedAt(LocalDateTime.now());
        dg.setStatus(DailyGage.Status.SETTLED);
        dailyGageRepository.save(dg);

        log.info("🃏 Daily gage '{}' assigned to {} (group {}) for {} ({} pts, {} loser(s) in draw)",
                forfeit.getTitle(), unlucky.getUsername(), groupId, matchDay, minPoints, losers.size());
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

        long unfinished = matchRepository.countUnfinishedMatchesOnDay(startOfDay, endOfDay, Match.Status.FINISHED);
        if (unfinished > 0) {
            throw new IllegalStateException(
                    unfinished + " match(es) non terminé(s) ce jour-là — impossible de forcer l'attribution");
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
        return matchRepository.countUnfinishedMatchesOnDay(start, end, Match.Status.FINISHED) == 0;
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
        return dailyGageRepository.findById(id)
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

    private DailyGageResponse toResponse(DailyGage dg, User currentUser) {
        Long currentUserId = currentUser != null ? currentUser.getId() : null;

        List<DailyGageCandidateResponse> candidateResponses = dg.getCandidates().stream()
                .map(c -> {
                    int userVote = 0;
                    if (currentUserId != null) {
                        Optional<DailyGageVote> v = c.getVotes().stream()
                                .filter(vote -> vote.getUser().getId().equals(currentUserId))
                                .findFirst();
                        userVote = v.map(DailyGageVote::getVote).orElse(0);
                    }
                    return DailyGageCandidateResponse.builder()
                            .id(c.getId())
                            .forfeit(toForfeitResponse(c.getForfeit()))
                            .voteScore(c.getVoteScore())
                            .userVote(userVote)
                            .build();
                })
                .toList();

        boolean canForceSettle = dg.getStatus() == DailyGage.Status.ACTIVE
                && allMatchesFinishedOnDay(dg.getMatchDate());

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
