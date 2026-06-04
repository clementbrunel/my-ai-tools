package com.pronocore.service;

import com.pronocore.dto.request.CreateBetRequest;
import com.pronocore.dto.request.ParticipateRequest;
import com.pronocore.dto.response.BetParticipationResponse;
import com.pronocore.dto.response.BetResponse;
import com.pronocore.entity.*;
import com.pronocore.mapper.BetMapper;
import com.pronocore.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BetService {

    private final BetRepository betRepository;
    private final BetParticipationRepository participationRepository;
    private final UserRepository userRepository;
    private final MatchRepository matchRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ForfeitRepository forfeitRepository;
    private final UserForfeitRepository userForfeitRepository;
    private final BetMapper betMapper;

    // ---------------------------------------------------------------
    // Queries (always scoped to the caller's groups)
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<BetResponse> getBetsForUser(String username) {
        User user = requireUser(username);
        return betRepository.findAllInUserActiveGroups(user.getId()).stream()
            .map(this::toBetResponseWithCount)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<BetResponse> getParticipatedBets(String username) {
        User user = requireUser(username);
        return betRepository.findParticipatedBetsByUserId(user.getId()).stream()
            .map(this::toBetResponseWithCount)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<BetResponse> getBetsByMatch(Long matchId, String username) {
        User user = requireUser(username);
        return betRepository.findByMatchIdInUserActiveGroups(matchId, user.getId()).stream()
            .map(this::toBetResponseWithCount)
            .toList();
    }

    @Transactional(readOnly = true)
    public BetResponse getBetById(Long id, String username) {
        Bet bet = requireBet(id);
        requireActiveMembership(bet.getGroup().getId(), requireUser(username).getId());
        return toBetResponseWithCount(bet);
    }

    @Transactional(readOnly = true)
    public List<BetParticipationResponse> getParticipations(Long betId, String username) {
        Bet bet = requireBet(betId);
        requireActiveMembership(bet.getGroup().getId(), requireUser(username).getId());
        return participationRepository.findByBetId(betId).stream()
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
        requireGroupAdmin(groupId, requester.getId());

        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new EntityNotFoundException("Group not found: " + groupId));
        Match match = matchRepository.findById(matchId)
            .orElseThrow(() -> new EntityNotFoundException("Match not found: " + matchId));

        if (betRepository.existsByMatchIdAndGroupId(matchId, groupId)) {
            throw new IllegalStateException("This match is already open for betting in this group");
        }

        Bet bet = Bet.builder()
            .title(match.getTeamA() + " vs " + match.getTeamB())
            .betType(Bet.BetType.SCORE)
            .points(10)
            .deadline(match.getMatchDate())   // deadline = kick-off time
            .status(Bet.Status.OPEN)
            .creator(requester)
            .group(group)
            .match(match)
            .build();

        return toBetResponseWithCount(betRepository.save(bet));
    }

    /**
     * A group admin creates a custom bet (title / type / points) on a match for their group.
     * Like {@link #openMatchForBetting}, a group may hold at most one bet per match.
     */
    @Transactional
    public BetResponse createBet(CreateBetRequest request, String username) {
        User creator = requireUser(username);
        requireGroupAdmin(request.getGroupId(), creator.getId());

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
        requireActiveMembership(bet.getGroup().getId(), user.getId());

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
    public BetParticipationResponse upsertParticipate(Long betId, ParticipateRequest request, String username) {
        Bet bet = requireBet(betId);
        assertOpenForParticipation(bet);

        User user = requireUser(username);
        requireActiveMembership(bet.getGroup().getId(), user.getId());

        BetParticipation participation = participationRepository.findByBetIdAndUserId(betId, user.getId())
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

            List<Forfeit> activeForfeit = forfeitRepository.findByActiveTrue();
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

    private GroupMember requireActiveMembership(Long groupId, Long userId) {
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
            .orElseThrow(() -> new AccessDeniedException("You are not a member of this group"));
        if (member.getStatus() != GroupMember.MemberStatus.ACTIVE) {
            throw new AccessDeniedException("Your membership in this group is pending approval");
        }
        return member;
    }

    private void requireGroupAdmin(Long groupId, Long userId) {
        if (requireActiveMembership(groupId, userId).getRole() != GroupMember.GroupRole.GROUP_ADMIN) {
            throw new AccessDeniedException("Group admin role required");
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

    private BetResponse toBetResponseWithCount(Bet bet) {
        BetResponse response = betMapper.toResponse(bet);
        response.setParticipationsCount(betRepository.countParticipationsByBetId(bet.getId()));
        return response;
    }
}
