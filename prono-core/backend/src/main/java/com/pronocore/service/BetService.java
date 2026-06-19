package com.pronocore.service;

import com.pronocore.dto.request.CreateBetRequest;
import com.pronocore.dto.request.ParticipateRequest;
import com.pronocore.dto.response.BetParticipationResponse;
import com.pronocore.dto.response.BetResponse;
import com.pronocore.dto.response.UserBetSummaryResponse;
import com.pronocore.entity.*;
import com.pronocore.mapper.BetMapper;
import com.pronocore.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BetService {

    private final BetRepository betRepository;
    private final BetParticipationRepository participationRepository;
    private final UserRepository userRepository;
    private final MatchRepository matchRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberGuard groupMemberGuard;
    private final ForfeitRepository forfeitRepository;
    private final UserForfeitRepository userForfeitRepository;
    private final BetMapper betMapper;

    // ---------------------------------------------------------------
    // Queries (always scoped to the caller's groups)
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<BetResponse> getBetsForUser(String username) {
        User user = requireUser(username);
        List<Bet> bets = betRepository.findAllInUserActiveGroups(user.getId());
        return toBetResponsesWithCounts(bets);
    }

    @Transactional(readOnly = true)
    public List<BetResponse> getBetsByMatch(Long matchId, String username) {
        User user = requireUser(username);
        List<Bet> bets = betRepository.findByMatchIdInUserActiveGroups(matchId, user.getId());
        return toBetResponsesWithCounts(bets);
    }

    @Transactional(readOnly = true)
    public BetResponse getBetById(Long id, String username) {
        Bet bet = requireBet(id);
        groupMemberGuard.requireActiveMembership(bet.getGroup().getId(), requireUser(username).getId());
        return toBetResponseWithCount(bet);
    }

    @Transactional(readOnly = true)
    public List<BetParticipationResponse> getParticipations(Long betId, String username) {
        Bet bet = requireBet(betId);
        groupMemberGuard.requireActiveMembership(bet.getGroup().getId(), requireUser(username).getId());
        return participationRepository.findByBetId(betId).stream()
            .map(betMapper::toParticipationResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<UserBetSummaryResponse> getMyParticipations(String username) {
        User user = requireUser(username);
        return participationRepository.findByUserId(user.getId()).stream()
            .sorted(java.util.Comparator.comparing(
                bp -> bp.getBet().getMatch() != null ? bp.getBet().getMatch().getMatchDate() : bp.getCreatedAt(),
                java.util.Comparator.reverseOrder()))
            .map(bp -> {
                Bet bet = bp.getBet();
                var matchTeamA = bet.getMatch() != null ? bet.getMatch().getTeamA() : null;
                var matchTeamB = bet.getMatch() != null ? bet.getMatch().getTeamB() : null;
                var matchDate  = bet.getMatch() != null ? bet.getMatch().getMatchDate() : null;
                return UserBetSummaryResponse.builder()
                    .participationId(bp.getId())
                    .betId(bet.getId())
                    .betTitle(bet.getTitle())
                    .matchTeamA(matchTeamA)
                    .matchTeamB(matchTeamB)
                    .matchDate(matchDate)
                    .betStatus(bet.getStatus())
                    .betPoints(bet.getPoints())
                    .chosenOption(bp.getChosenOption())
                    .winningOption(bet.getWinningOption())
                    .pointsEarned(bp.getPointsEarned())
                    .participatedAt(bp.getCreatedAt())
                    .build();
            })
            .toList();
    }

    @Transactional(readOnly = true)
    public List<UserBetSummaryResponse> getUserBetsInGroup(Long groupId, Long userId, String callerUsername) {
        User caller = requireUser(callerUsername);
        groupMemberGuard.requireActiveMembership(groupId, caller.getId());
        return participationRepository.findByUserIdAndGroupId(userId, groupId, java.time.LocalDateTime.now()).stream()
            .map(bp -> {
                Bet bet = bp.getBet();
                var matchTeamA = bet.getMatch() != null ? bet.getMatch().getTeamA() : null;
                var matchTeamB = bet.getMatch() != null ? bet.getMatch().getTeamB() : null;
                var matchDate  = bet.getMatch() != null ? bet.getMatch().getMatchDate() : null;
                return UserBetSummaryResponse.builder()
                    .participationId(bp.getId())
                    .betId(bet.getId())
                    .betTitle(bet.getTitle())
                    .matchTeamA(matchTeamA)
                    .matchTeamB(matchTeamB)
                    .matchDate(matchDate)
                    .betStatus(bet.getStatus())
                    .betPoints(bet.getPoints())
                    .chosenOption(bp.getChosenOption())
                    .winningOption(bet.getWinningOption())
                    .pointsEarned(bp.getPointsEarned())
                    .participatedAt(bp.getCreatedAt())
                    .build();
            })
            .toList();
    }

    @Transactional(readOnly = true)
    public List<BetParticipationResponse> getParticipationsByMatch(Long matchId, String username) {
        User user = requireUser(username);
        return participationRepository.findByMatchIdInUserActiveGroups(matchId, user.getId()).stream()
            .collect(Collectors.toMap(
                p -> p.getUser().getId(),
                p -> p,
                (existing, duplicate) -> existing
            ))
            .values().stream()
            .map(betMapper::toParticipationResponse)
            .toList();
    }

    // ---------------------------------------------------------------
    // Opening a match for betting (group admin)
    // ---------------------------------------------------------------

    /**
     * A group admin opens a (global) match for betting in their group.
     * Creates the standard exact-score prediction bet for that (match, group).
     */
    @Transactional
    public BetResponse openMatchForBetting(Long groupId, Long matchId, String username) {
        User requester = requireUser(username);
        groupMemberGuard.requireGroupAdmin(groupId, requester.getId());

        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new EntityNotFoundException("Group not found: " + groupId));
        Match match = matchRepository.findById(matchId)
            .orElseThrow(() -> new EntityNotFoundException("Match not found: " + matchId));

        if (betRepository.existsByMatchIdAndGroupId(matchId, groupId)) {
            throw new IllegalStateException("This match is already open for betting in this group");
        }

        return toBetResponseWithCount(betRepository.save(buildScoreBet(match, group, requester)));
    }

    /**
     * A group admin closes a match for betting in their group.
     * Deletes all OPEN bets (and their participations) for that (match, group) pair.
     */
    @Transactional
    public void closeMatchForBetting(Long groupId, Long matchId, String username) {
        User requester = requireUser(username);
        groupMemberGuard.requireGroupAdmin(groupId, requester.getId());

        List<Bet> bets = betRepository.findByMatchIdAndGroupId(matchId, groupId);
        for (Bet bet : bets) {
            participationRepository.deleteAll(participationRepository.findByBetId(bet.getId()));
            betRepository.delete(bet);
        }
    }

    /**
     * Open every match of a competition for betting in the group, in one action.
     * Matches already open in the group are skipped (idempotent), so the admin can
     * re-run it after new matches are added. Returns only the newly created bets.
     */
    @Transactional
    public List<BetResponse> openCompetitionForBetting(Long groupId, String competition, String username) {
        User requester = requireUser(username);
        groupMemberGuard.requireGroupAdmin(groupId, requester.getId());

        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new EntityNotFoundException("Group not found: " + groupId));

        return matchRepository.findByCompetitionOrderByMatchDateAsc(competition).stream()
            .filter(match -> !betRepository.existsByMatchIdAndGroupId(match.getId(), groupId))
            .map(match -> toBetResponseWithCount(betRepository.save(buildScoreBet(match, group, requester))))
            .toList();
    }

    private Bet buildScoreBet(Match match, Group group, User creator) {
        return Bet.builder()
            .title(match.getTeamA() + " vs " + match.getTeamB())
            .betType(Bet.BetType.SCORE)
            .points(10)
            .deadline(match.getMatchDate())   // deadline = kick-off time
            .status(Bet.Status.OPEN)
            .creator(creator)
            .group(group)
            .match(match)
            .build();
    }

    /**
     * A group admin creates a custom bet (title / type / points) on a match for their group.
     * Like {@link #openMatchForBetting}, a group may hold at most one bet per match.
     */
    @Transactional
    public BetResponse createBet(CreateBetRequest request, String username) {
        User creator = requireUser(username);
        groupMemberGuard.requireGroupAdmin(request.getGroupId(), creator.getId());

        Group group = groupRepository.findById(request.getGroupId())
            .orElseThrow(() -> new EntityNotFoundException("Group not found: " + request.getGroupId()));
        Match match = matchRepository.findById(request.getMatchId())
            .orElseThrow(() -> new EntityNotFoundException("Match not found: " + request.getMatchId()));

        if (betRepository.existsByMatchIdAndGroupId(request.getMatchId(), request.getGroupId())) {
            throw new IllegalStateException("This match is already open for betting in this group");
        }

        Bet bet = Bet.builder()
            .title(request.getTitle())
            .description(request.getDescription())
            .betType(request.getBetType())
            .points(request.getPoints())
            .deadline(match.getMatchDate())   // deadline = kick-off time
            .status(Bet.Status.OPEN)
            .creator(creator)
            .group(group)
            .match(match)
            .build();

        return toBetResponseWithCount(betRepository.save(bet));
    }

    // ---------------------------------------------------------------
    // Participation
    // ---------------------------------------------------------------

    @Transactional
    public BetParticipationResponse participate(Long betId, ParticipateRequest request, String username) {
        Bet bet = requireBet(betId);
        assertOpenForParticipation(bet);

        User user = requireUser(username);
        groupMemberGuard.requireActiveMembership(bet.getGroup().getId(), user.getId());

        if (participationRepository.existsByBetIdAndUserId(betId, user.getId())) {
            throw new IllegalStateException("User already participated in this bet");
        }

        BetParticipation participation = BetParticipation.builder()
            .bet(bet)
            .user(user)
            .chosenOption(request.getChosenOption())
            .comment(request.getComment())
            .build();

        return betMapper.toParticipationResponse(participationRepository.save(participation));
    }

    @Transactional
    public List<BetParticipationResponse> upsertParticipateByMatch(Long matchId, ParticipateRequest request, String username) {
        User user = requireUser(username);
        List<Bet> bets = betRepository.findByMatchIdInUserActiveGroups(matchId, user.getId());
        return bets.stream()
            .filter(bet -> {
                try { assertOpenForParticipation(bet); return true; }
                catch (IllegalStateException e) { return false; }
            })
            .map(bet -> {
                BetParticipation participation = participationRepository.findByBetIdAndUserId(bet.getId(), user.getId())
                    .map(existing -> {
                        existing.setChosenOption(request.getChosenOption());
                        existing.setComment(request.getComment());
                        return existing;
                    })
                    .orElseGet(() -> BetParticipation.builder()
                        .bet(bet)
                        .user(user)
                        .chosenOption(request.getChosenOption())
                        .comment(request.getComment())
                        .build());
                return betMapper.toParticipationResponse(participationRepository.save(participation));
            })
            .toList();
    }

    // ---------------------------------------------------------------
    // Admin settlement
    // ---------------------------------------------------------------

    @Transactional
    public BetResponse validateBet(Long betId, String winningOption) {
        Bet bet = requireBet(betId);

        // Idempotence: a bet may only be settled once. Re-validating would credit
        // points/forfeits twice and corrupt the (group) leaderboard.
        if (bet.getStatus() != Bet.Status.OPEN) {
            throw new IllegalStateException("Bet is not open — it has already been settled or cancelled");
        }

        bet.setStatus(Bet.Status.VALIDATED);
        bet.setWinningOption(winningOption);

        // Award points to winners
        List<BetParticipation> winners = participationRepository.findByBetIdAndChosenOption(betId, winningOption);
        for (BetParticipation winner : winners) {
            User user = winner.getUser();
            user.setGlobalScore(user.getGlobalScore() + bet.getPoints());
            user.setBetsWon(user.getBetsWon() + 1);
            userRepository.save(user);

            // Persist pointsEarned so the group leaderboard / dashboard (which sum
            // pointsEarned per group) stay consistent with the auto-settlement path.
            winner.setPointsEarned(bet.getPoints());
            participationRepository.save(winner);
        }

        // Assign forfeits to losers if it's a FORFEIT type bet
        if (bet.getBetType() == Bet.BetType.FORFEIT) {
            List<BetParticipation> losers = participationRepository.findByBetId(betId).stream()
                .filter(p -> !p.getChosenOption().equals(winningOption))
                .toList();

            // Pick from the gages visible to THIS group (shared + group-specific), not all gages.
            List<Forfeit> activeForfeit =
                forfeitRepository.findActiveVisibleToGroups(List.of(bet.getGroup().getId()));
            if (!activeForfeit.isEmpty() && !losers.isEmpty()) {
                Forfeit randomForfeit = activeForfeit.get(
                    (int)(Math.random() * activeForfeit.size())
                );

                User betCreator = bet.getCreator();
                for (BetParticipation loser : losers) {
                    User loserUser = loser.getUser();
                    loserUser.setForfeitsReceived(loserUser.getForfeitsReceived() + 1);
                    userRepository.save(loserUser);

                    UserForfeit userForfeit = UserForfeit.builder()
                        .user(loserUser)
                        .forfeit(randomForfeit)
                        .assignedBy(betCreator)
                        .bet(bet)
                        .group(bet.getGroup())
                        .completed(false)
                        .build();
                    userForfeitRepository.save(userForfeit);
                }
            }
        }

        return toBetResponseWithCount(betRepository.save(bet));
    }

    @Transactional
    public BetResponse cancelBet(Long betId) {
        Bet bet = requireBet(betId);
        bet.setStatus(Bet.Status.CANCELLED);
        return toBetResponseWithCount(betRepository.save(bet));
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private void assertOpenForParticipation(Bet bet) {
        if (bet.getStatus() != Bet.Status.OPEN) {
            throw new IllegalStateException("Bet is not open for participation");
        }
        if (bet.getDeadline() != null && java.time.LocalDateTime.now().isAfter(bet.getDeadline())) {
            throw new IllegalStateException("Le match a déjà commencé, les paris sont fermés");
        }
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
    }

    private Bet requireBet(Long betId) {
        return betRepository.findById(betId)
            .orElseThrow(() -> new EntityNotFoundException("Bet not found: " + betId));
    }

    /** Batch-loads participation counts for a list of bets (single query instead of N). */
    private List<BetResponse> toBetResponsesWithCounts(List<Bet> bets) {
        if (bets.isEmpty()) return List.of();
        List<Long> ids = bets.stream().map(Bet::getId).toList();
        Map<Long, Long> counts = betRepository.countParticipationsByBetIds(ids).stream()
            .collect(java.util.stream.Collectors.toMap(
                row -> (Long) row[0],
                row -> (Long) row[1]
            ));
        return bets.stream().map(bet -> {
            BetResponse r = betMapper.toResponse(bet);
            r.setParticipationsCount(counts.getOrDefault(bet.getId(), 0L));
            return r;
        }).toList();
    }

    private BetResponse toBetResponseWithCount(Bet bet) {
        BetResponse response = betMapper.toResponse(bet);
        response.setParticipationsCount(betRepository.countParticipationsByBetId(bet.getId()));
        return response;
    }
}
