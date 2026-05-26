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
    private final ForfeitRepository forfeitRepository;
    private final UserForfeitRepository userForfeitRepository;
    private final BetMapper betMapper;

    @Transactional(readOnly = true)
    public List<BetResponse> getAllBets() {
        return betRepository.findAllByOrderByCreatedAtDesc().stream()
            .map(this::toBetResponseWithCount)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<BetResponse> getBetsByMatch(Long matchId) {
        return betRepository.findByMatchIdOrderByCreatedAtDesc(matchId).stream()
            .map(this::toBetResponseWithCount)
            .toList();
    }

    @Transactional(readOnly = true)
    public BetResponse getBetById(Long id) {
        Bet bet = betRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Bet not found: " + id));
        return toBetResponseWithCount(bet);
    }

    @Transactional
    public BetResponse createBet(CreateBetRequest request, String username) {
        User creator = userRepository.findByUsername(username)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        Match match = matchRepository.findById(request.getMatchId())
            .orElseThrow(() -> new EntityNotFoundException("Match not found: " + request.getMatchId()));

        Bet bet = Bet.builder()
            .title(request.getTitle())
            .description(request.getDescription())
            .betType(request.getBetType())
            .points(request.getPoints())
            .deadline(match.getMatchDate())   // deadline = kick-off time
            .status(Bet.Status.OPEN)
            .creator(creator)
            .match(match)
            .build();

        return toBetResponseWithCount(betRepository.save(bet));
    }

    @Transactional
    public BetParticipationResponse participate(Long betId, ParticipateRequest request, String username) {
        Bet bet = betRepository.findById(betId)
            .orElseThrow(() -> new EntityNotFoundException("Bet not found: " + betId));

        if (bet.getStatus() != Bet.Status.OPEN) {
            throw new IllegalStateException("Bet is not open for participation");
        }
        if (bet.getDeadline() != null && java.time.LocalDateTime.now().isAfter(bet.getDeadline())) {
            throw new IllegalStateException("Le match a déjà commencé, les paris sont fermés");
        }

        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

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

    @Transactional(readOnly = true)
    public List<BetParticipationResponse> getParticipations(Long betId) {
        return participationRepository.findByBetId(betId).stream()
            .map(betMapper::toParticipationResponse)
            .toList();
    }

    @Transactional
    public BetResponse validateBet(Long betId, String winningOption) {
        Bet bet = betRepository.findById(betId)
            .orElseThrow(() -> new EntityNotFoundException("Bet not found: " + betId));

        bet.setStatus(Bet.Status.VALIDATED);
        bet.setWinningOption(winningOption);

        // Award points to winners
        List<BetParticipation> winners = participationRepository.findByBetIdAndChosenOption(betId, winningOption);
        for (BetParticipation winner : winners) {
            User user = winner.getUser();
            user.setGlobalScore(user.getGlobalScore() + bet.getPoints());
            user.setBetsWon(user.getBetsWon() + 1);
            userRepository.save(user);
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
        Bet bet = betRepository.findById(betId)
            .orElseThrow(() -> new EntityNotFoundException("Bet not found: " + betId));
        bet.setStatus(Bet.Status.CANCELLED);
        return toBetResponseWithCount(betRepository.save(bet));
    }

    private BetResponse toBetResponseWithCount(Bet bet) {
        BetResponse response = betMapper.toResponse(bet);
        response.setParticipationsCount(betRepository.countParticipationsByBetId(bet.getId()));
        return response;
    }
}
