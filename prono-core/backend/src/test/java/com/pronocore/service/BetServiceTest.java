package com.pronocore.service;

import com.pronocore.dto.request.CreateBetRequest;
import com.pronocore.dto.request.ParticipateRequest;
import com.pronocore.dto.response.BetResponse;
import com.pronocore.entity.*;
import com.pronocore.mapper.BetMapper;
import com.pronocore.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BetServiceTest {

    @Mock
    private BetRepository betRepository;
    @Mock
    private BetParticipationRepository participationRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private MatchRepository matchRepository;
    @Mock
    private ForfeitRepository forfeitRepository;
    @Mock
    private UserForfeitRepository userForfeitRepository;
    @Mock
    private BetMapper betMapper;

    @InjectMocks
    private BetService betService;

    private User testUser;
    private Bet testBet;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
            .id(1L)
            .username("testuser")
            .email("test@example.com")
            .password("encoded")
            .role(User.Role.USER)
            .globalScore(0)
            .betsWon(0)
            .forfeitsReceived(0)
            .build();

        testBet = Bet.builder()
            .id(1L)
            .title("Test Bet")
            .description("Test description")
            .betType(Bet.BetType.FREE)
            .points(10)
            .deadline(LocalDateTime.now().plusHours(2))
            .status(Bet.Status.OPEN)
            .creator(testUser)
            .build();
    }

    @Test
    void createBet_shouldCreateBetSuccessfully() {
        CreateBetRequest request = new CreateBetRequest();
        request.setTitle("Test Bet");
        request.setDescription("Test description");
        request.setBetType(Bet.BetType.FREE);
        request.setPoints(10);
        request.setDeadline(LocalDateTime.now().plusHours(2));

        BetResponse expectedResponse = BetResponse.builder()
            .id(1L)
            .title("Test Bet")
            .status(Bet.Status.OPEN)
            .build();

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(betRepository.save(any(Bet.class))).thenReturn(testBet);
        when(betMapper.toResponse(any(Bet.class))).thenReturn(expectedResponse);
        when(betRepository.countParticipationsByBetId(any())).thenReturn(0L);

        BetResponse result = betService.createBet(request, "testuser");

        assertThat(result).isNotNull();
        assertThat(result.getTitle()).isEqualTo("Test Bet");
        verify(betRepository).save(any(Bet.class));
    }

    @Test
    void participate_shouldThrowWhenBetNotOpen() {
        testBet.setStatus(Bet.Status.VALIDATED);

        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Option A");

        assertThatThrownBy(() -> betService.participate(1L, request, "testuser"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("not open");
    }

    @Test
    void participate_shouldThrowWhenAlreadyParticipated() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(participationRepository.existsByBetIdAndUserId(1L, 1L)).thenReturn(true);

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Option A");

        assertThatThrownBy(() -> betService.participate(1L, request, "testuser"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("already participated");
    }

    @Test
    void validateBet_shouldAwardPointsToWinners() {
        User winner = User.builder()
            .id(2L)
            .username("winner")
            .globalScore(0)
            .betsWon(0)
            .forfeitsReceived(0)
            .build();

        BetParticipation participation = BetParticipation.builder()
            .id(1L)
            .bet(testBet)
            .user(winner)
            .chosenOption("France")
            .build();

        BetResponse expectedResponse = BetResponse.builder()
            .id(1L)
            .status(Bet.Status.VALIDATED)
            .winningOption("France")
            .build();

        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));
        when(participationRepository.findByBetIdAndChosenOption(1L, "France"))
            .thenReturn(List.of(participation));
        when(betRepository.save(any(Bet.class))).thenReturn(testBet);
        when(betMapper.toResponse(any(Bet.class))).thenReturn(expectedResponse);
        when(betRepository.countParticipationsByBetId(any())).thenReturn(1L);

        BetResponse result = betService.validateBet(1L, "France");

        assertThat(result.getStatus()).isEqualTo(Bet.Status.VALIDATED);
        assertThat(winner.getGlobalScore()).isEqualTo(10);
        assertThat(winner.getBetsWon()).isEqualTo(1);
        verify(userRepository).save(winner);
    }

    @Test
    void getAllBets_shouldReturnAllBets() {
        BetResponse betResponse = BetResponse.builder()
            .id(1L)
            .title("Test Bet")
            .build();

        when(betRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(testBet));
        when(betMapper.toResponse(any(Bet.class))).thenReturn(betResponse);
        when(betRepository.countParticipationsByBetId(any())).thenReturn(0L);

        List<BetResponse> result = betService.getAllBets();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTitle()).isEqualTo("Test Bet");
    }
}
