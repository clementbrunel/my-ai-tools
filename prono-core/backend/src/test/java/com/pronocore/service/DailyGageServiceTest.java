package com.pronocore.service;

import com.pronocore.dto.request.CreateDailyGageRequest;
import com.pronocore.dto.response.DailyGageResponse;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DailyGageServiceTest {

    @Mock private DailyGageRepository          dailyGageRepository;
    @Mock private DailyGageCandidateRepository candidateRepository;
    @Mock private DailyGageVoteRepository      voteRepository;
    @Mock private ForfeitRepository            forfeitRepository;
    @Mock private UserRepository               userRepository;
    @Mock private UserForfeitRepository        userForfeitRepository;
    @Mock private BetParticipationRepository   betParticipationRepository;
    @Mock private MatchRepository              matchRepository;

    @InjectMocks
    private DailyGageService dailyGageService;

    private static final LocalDate MATCH_DAY = LocalDate.of(2026, 6, 11);

    private User adminUser;
    private Match sampleMatch;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .id(1L)
                .username("admin")
                .email("admin@test.com")
                .password("encoded")
                .role(User.Role.ADMIN)
                .globalScore(0)
                .betsWon(0)
                .forfeitsReceived(0)
                .build();

        sampleMatch = Match.builder()
                .id(1L)
                .teamA("France")
                .teamB("Brésil")
                .matchDate(MATCH_DAY.atTime(20, 0))
                .status(Match.Status.UPCOMING)
                .competition("FIFA World Cup 2026")
                .round("Group Stage")
                .build();

        // Security context — needed by currentUsername() called in toResponse()
        SecurityContext sc   = mock(SecurityContext.class);
        Authentication  auth = mock(Authentication.class);
        lenient().when(auth.getName()).thenReturn("admin");
        lenient().when(sc.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(sc);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ── createDailyGage: no match on that day ─────────────────────────────────

    @Test
    void createDailyGage_shouldThrow_whenNoMatchExistsOnThatDay() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);

        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.empty());
        // MatchRepository returns an empty list → no matches scheduled
        when(matchRepository.findByMatchDay(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> dailyGageService.createDailyGage(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Aucun match prévu");

        verify(dailyGageRepository, never()).save(any());
    }

    // ── createDailyGage: happy path ───────────────────────────────────────────

    @Test
    void createDailyGage_shouldCreate_whenAtLeastOneMatchExistsOnThatDay() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);

        DailyGage saved = DailyGage.builder()
                .id(10L)
                .matchDate(MATCH_DAY)
                .mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.PENDING)
                .candidates(List.of())
                .build();

        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.empty());
        when(matchRepository.findByMatchDay(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(sampleMatch));
        when(dailyGageRepository.save(any(DailyGage.class))).thenReturn(saved);
        // toResponse() looks up the current user to compute userVote on candidates
        lenient().when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));

        DailyGageResponse result = dailyGageService.createDailyGage(req);

        assertThat(result).isNotNull();
        assertThat(result.getMatchDate()).isEqualTo(MATCH_DAY);
        assertThat(result.getMode()).isEqualTo("DIRECT");
        assertThat(result.getStatus()).isEqualTo("PENDING");
        assertThat(result.getCandidates()).isEmpty();
        verify(dailyGageRepository).save(any(DailyGage.class));
    }

    @Test
    void createDailyGage_shouldCreate_inVoteMode_whenMatchExists() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.VOTE);

        DailyGage saved = DailyGage.builder()
                .id(11L)
                .matchDate(MATCH_DAY)
                .mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.PENDING)
                .candidates(List.of())
                .build();

        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.empty());
        when(matchRepository.findByMatchDay(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(sampleMatch));
        when(dailyGageRepository.save(any(DailyGage.class))).thenReturn(saved);
        lenient().when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));

        DailyGageResponse result = dailyGageService.createDailyGage(req);

        assertThat(result.getMode()).isEqualTo("VOTE");
        verify(dailyGageRepository).save(any(DailyGage.class));
    }

    // ── createDailyGage: duplicate gage for same day ──────────────────────────

    @Test
    void createDailyGage_shouldThrow_whenGageAlreadyExistsForThatDay() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);

        DailyGage existing = DailyGage.builder()
                .id(99L)
                .matchDate(MATCH_DAY)
                .mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.PENDING)
                .candidates(List.of())
                .build();
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> dailyGageService.createDailyGage(req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already exists");

        verify(matchRepository, never()).findByMatchDay(any(), any());
        verify(dailyGageRepository, never()).save(any());
    }

    // ── helper ────────────────────────────────────────────────────────────────

    private static CreateDailyGageRequest buildRequest(LocalDate date, DailyGage.Mode mode) {
        CreateDailyGageRequest req = new CreateDailyGageRequest();
        req.setMatchDate(date);
        req.setMode(mode);
        return req;
    }
}
