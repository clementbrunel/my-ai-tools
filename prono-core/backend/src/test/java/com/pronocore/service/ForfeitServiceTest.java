package com.pronocore.service;

import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.dto.response.UserForfeitResponse;
import com.pronocore.entity.Forfeit;
import com.pronocore.entity.User;
import com.pronocore.entity.UserForfeit;
import com.pronocore.repository.ForfeitRepository;
import com.pronocore.repository.UserForfeitRepository;
import com.pronocore.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ForfeitServiceTest {

    @Mock private ForfeitRepository     forfeitRepository;
    @Mock private UserForfeitRepository userForfeitRepository;
    @Mock private UserRepository        userRepository;

    @InjectMocks
    private ForfeitService forfeitService;

    private User adminUser;
    private User regularUser;
    private Forfeit forfeit;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .id(1L).username("admin").email("admin@test.com")
                .password("encoded").role(User.Role.ADMIN)
                .globalScore(0).betsWon(0).forfeitsReceived(0)
                .build();

        regularUser = User.builder()
                .id(2L).username("player").email("player@test.com")
                .password("encoded").role(User.Role.USER)
                .globalScore(0).betsWon(0).forfeitsReceived(0)
                .build();

        forfeit = Forfeit.builder()
                .id(10L).title("Drink water").description("Drink a glass")
                .category("Fun").active(true).timesCompleted(0)
                .build();

        setCurrentUser("player");
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private void setCurrentUser(String username) {
        SecurityContext sc   = mock(SecurityContext.class);
        Authentication  auth = mock(Authentication.class);
        lenient().when(auth.getName()).thenReturn(username);
        lenient().when(sc.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(sc);
    }

    // ── getAllForfeits ──────────────────────────────────────────────────────────

    @Test
    void getAllForfeits_shouldReturnOnlyActiveForfeits() {
        when(forfeitRepository.findByActiveTrue()).thenReturn(List.of(forfeit));

        List<ForfeitResponse> result = forfeitService.getAllForfeits();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTitle()).isEqualTo("Drink water");
        verify(forfeitRepository).findByActiveTrue();
        verify(forfeitRepository, never()).findAll();
    }

    // ── getAllForfeitsAdmin ─────────────────────────────────────────────────────

    @Test
    void getAllForfeitsAdmin_shouldReturnAllForfeitsIncludingInactive() {
        Forfeit inactive = Forfeit.builder()
                .id(11L).title("Old gage").description("desc")
                .category("Old").active(false).timesCompleted(0)
                .build();

        when(forfeitRepository.findAll()).thenReturn(List.of(forfeit, inactive));

        List<ForfeitResponse> result = forfeitService.getAllForfeitsAdmin();

        assertThat(result).hasSize(2);
        assertThat(result).extracting(ForfeitResponse::isActive).containsExactlyInAnyOrder(true, false);
        verify(forfeitRepository).findAll();
    }

    // ── createForfeit ──────────────────────────────────────────────────────────

    @Test
    void createForfeit_shouldSaveWithActiveTrueAndNoProposedBy() {
        when(forfeitRepository.save(any(Forfeit.class))).thenReturn(forfeit);

        forfeitService.createForfeit("Drink water", "Drink a glass", "Fun");

        ArgumentCaptor<Forfeit> captor = ArgumentCaptor.forClass(Forfeit.class);
        verify(forfeitRepository).save(captor.capture());
        assertThat(captor.getValue().isActive()).isTrue();
        assertThat(captor.getValue().getProposedBy()).isNull();
        assertThat(captor.getValue().getTitle()).isEqualTo("Drink water");
    }

    // ── proposeForfeit ─────────────────────────────────────────────────────────

    @Test
    void proposeForfeit_shouldSetProposedByToCurrentUser() {
        when(userRepository.findByUsername("player")).thenReturn(Optional.of(regularUser));
        when(forfeitRepository.save(any(Forfeit.class))).thenReturn(forfeit);

        forfeitService.proposeForfeit("My gage", "A description", "Custom");

        ArgumentCaptor<Forfeit> captor = ArgumentCaptor.forClass(Forfeit.class);
        verify(forfeitRepository).save(captor.capture());
        assertThat(captor.getValue().getProposedBy()).isEqualTo(regularUser);
        assertThat(captor.getValue().isActive()).isTrue();
        assertThat(captor.getValue().getCategory()).isEqualTo("Custom");
    }

    @Test
    void proposeForfeit_shouldDefaultCategoryToGeneralWhenNull() {
        when(userRepository.findByUsername("player")).thenReturn(Optional.of(regularUser));
        when(forfeitRepository.save(any(Forfeit.class))).thenReturn(forfeit);

        forfeitService.proposeForfeit("My gage", "description", null);

        ArgumentCaptor<Forfeit> captor = ArgumentCaptor.forClass(Forfeit.class);
        verify(forfeitRepository).save(captor.capture());
        assertThat(captor.getValue().getCategory()).isEqualTo("General");
    }

    // ── deleteForfeit (soft delete) ────────────────────────────────────────────

    @Test
    void deleteForfeit_shouldSetActiveFalseWithoutDeletingRow() {
        when(forfeitRepository.findById(10L)).thenReturn(Optional.of(forfeit));

        forfeitService.deleteForfeit(10L);

        assertThat(forfeit.isActive()).isFalse();
        verify(forfeitRepository).save(forfeit);
        verify(forfeitRepository, never()).delete(any());
        verify(forfeitRepository, never()).deleteById(any());
    }

    @Test
    void deleteForfeit_shouldThrowWhenForfeitNotFound() {
        when(forfeitRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> forfeitService.deleteForfeit(99L))
                .isInstanceOf(EntityNotFoundException.class);
    }

    // ── assignForfeit ─────────────────────────────────────────────────────────

    @Test
    void assignForfeit_shouldIncrementForfeitsReceivedAndPersistUserForfeit() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(regularUser));
        when(forfeitRepository.findById(10L)).thenReturn(Optional.of(forfeit));
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        forfeitService.assignForfeit(2L, 10L, 1L);

        assertThat(regularUser.getForfeitsReceived()).isEqualTo(1);
        verify(userRepository).save(regularUser);

        ArgumentCaptor<UserForfeit> captor = ArgumentCaptor.forClass(UserForfeit.class);
        verify(userForfeitRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isEqualTo(regularUser);
        assertThat(captor.getValue().getForfeit()).isEqualTo(forfeit);
        assertThat(captor.getValue().getAssignedBy()).isEqualTo(adminUser);
        assertThat(captor.getValue().isCompleted()).isFalse();
    }

    // ── completeForfeit ────────────────────────────────────────────────────────

    @Test
    void completeForfeit_ownerCanCompleteTheirOwnForfeit() {
        UserForfeit uf = UserForfeit.builder()
                .id(1L).user(regularUser).forfeit(forfeit)
                .assignedBy(adminUser).completed(false)
                .build();

        when(userForfeitRepository.findById(1L)).thenReturn(Optional.of(uf));
        when(userRepository.findByUsername("player")).thenReturn(Optional.of(regularUser));

        forfeitService.completeForfeit(1L);

        assertThat(uf.isCompleted()).isTrue();
        assertThat(uf.getCompletedAt()).isNotNull();
        assertThat(forfeit.getTimesCompleted()).isEqualTo(1);
        verify(userForfeitRepository).save(uf);
        verify(forfeitRepository).save(forfeit);
    }

    @Test
    void completeForfeit_adminCanCompleteAnyPlayerForfeit() {
        setCurrentUser("admin");

        UserForfeit uf = UserForfeit.builder()
                .id(2L).user(regularUser).forfeit(forfeit)
                .assignedBy(adminUser).completed(false)
                .build();

        when(userForfeitRepository.findById(2L)).thenReturn(Optional.of(uf));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));

        forfeitService.completeForfeit(2L);

        assertThat(uf.isCompleted()).isTrue();
        assertThat(forfeit.getTimesCompleted()).isEqualTo(1);
    }

    @Test
    void completeForfeit_strangerCannotCompleteOtherPlayerForfeit() {
        User stranger = User.builder()
                .id(99L).username("stranger").email("s@test.com")
                .password("encoded").role(User.Role.USER)
                .globalScore(0).betsWon(0).forfeitsReceived(0)
                .build();
        setCurrentUser("stranger");

        UserForfeit uf = UserForfeit.builder()
                .id(3L).user(regularUser).forfeit(forfeit)
                .assignedBy(adminUser).completed(false)
                .build();

        when(userForfeitRepository.findById(3L)).thenReturn(Optional.of(uf));
        when(userRepository.findByUsername("stranger")).thenReturn(Optional.of(stranger));

        assertThatThrownBy(() -> forfeitService.completeForfeit(3L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("your own gage");
    }

    // ── getPendingForfeits ────────────────────────────────────────────────────

    @Test
    void getPendingForfeits_shouldReturnOnlyIncompleteForfeits() {
        UserForfeit pending = UserForfeit.builder()
                .id(1L).user(regularUser).forfeit(forfeit)
                .assignedBy(adminUser).completed(false)
                .build();

        when(userForfeitRepository.findByUserIdAndCompletedFalse(2L)).thenReturn(List.of(pending));

        List<UserForfeitResponse> result = forfeitService.getPendingForfeits(2L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).isCompleted()).isFalse();
        verify(userForfeitRepository).findByUserIdAndCompletedFalse(2L);
        verify(userForfeitRepository, never()).findByUserId(any());
    }

    // ── getMyForfeits ─────────────────────────────────────────────────────────

    @Test
    void getMyForfeits_shouldFetchForfeitsForCurrentUser() {
        UserForfeit uf = UserForfeit.builder()
                .id(1L).user(regularUser).forfeit(forfeit)
                .assignedBy(adminUser).completed(false)
                .build();

        when(userRepository.findByUsername("player")).thenReturn(Optional.of(regularUser));
        when(userForfeitRepository.findByUserId(regularUser.getId())).thenReturn(List.of(uf));

        List<UserForfeitResponse> result = forfeitService.getMyForfeits();

        assertThat(result).hasSize(1);
        verify(userForfeitRepository).findByUserId(regularUser.getId());
    }
}
