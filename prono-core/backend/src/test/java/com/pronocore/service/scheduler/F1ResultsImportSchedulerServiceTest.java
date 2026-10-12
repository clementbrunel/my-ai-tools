package com.pronocore.service.scheduler;

import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.repository.RaceRepository;
import com.pronocore.repository.UserRepository;
import com.pronocore.service.EmailService;
import com.pronocore.service.f1.F1SyncService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class F1ResultsImportSchedulerServiceTest {

    @Mock private RaceRepository raceRepository;
    @Mock private UserRepository userRepository;
    @Mock private F1SyncService f1SyncService;
    @Mock private EmailService emailService;
    @InjectMocks private F1ResultsImportSchedulerService scheduler;

    private final Race race = Race.builder().id(7L).name("GP de Monaco")
            .raceDate(LocalDateTime.now().minusHours(3)).build();

    @BeforeEach
    void config() {
        ReflectionTestUtils.setField(scheduler, "enabled", true);
        ReflectionTestUtils.setField(scheduler, "raceDurationMinutes", 120L);
        ReflectionTestUtils.setField(scheduler, "giveUpHours", 48L);
    }

    @Test
    void draftStaged_notifiesEveryAdmin() {
        User admin = User.builder().id(1L).username("admin").build();
        when(raceRepository.findAwaitingResultsImport(any(), any())).thenReturn(List.of(race));
        when(f1SyncService.importResultsDraftIfAvailable(7L)).thenReturn(true);
        when(userRepository.findByRole(User.Role.PLATFORM_ADMIN)).thenReturn(List.of(admin));

        scheduler.importFinishedRaces();

        verify(emailService).sendAdminResultsReadyEmail(admin, race);
    }

    @Test
    void nothingOnJolpicaYet_sendsNoEmail() {
        when(raceRepository.findAwaitingResultsImport(any(), any())).thenReturn(List.of(race));
        when(f1SyncService.importResultsDraftIfAvailable(7L)).thenReturn(false);

        scheduler.importFinishedRaces();

        verifyNoInteractions(emailService);
    }

    @Test
    void jolpicaFailure_isSwallowedSoNextTickRetries() {
        when(raceRepository.findAwaitingResultsImport(any(), any())).thenReturn(List.of(race));
        when(f1SyncService.importResultsDraftIfAvailable(7L)).thenThrow(new IllegalStateException("jolpica down"));

        scheduler.importFinishedRaces();

        verifyNoInteractions(emailService);
    }

    @Test
    void disabled_doesNothing() {
        ReflectionTestUtils.setField(scheduler, "enabled", false);

        scheduler.importFinishedRaces();

        verifyNoInteractions(raceRepository, f1SyncService, emailService);
    }
}
