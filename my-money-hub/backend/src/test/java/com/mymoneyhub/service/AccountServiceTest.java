package com.mymoneyhub.service;

import com.mymoneyhub.dto.CreateManualAccountRequest;
import com.mymoneyhub.dto.UpdateBalanceRequest;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.BalanceSnapshot;
import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.repository.AccountRepository;
import com.mymoneyhub.repository.BalanceSnapshotRepository;
import com.mymoneyhub.repository.InstitutionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock AccountRepository accountRepository;
    @Mock InstitutionRepository institutionRepository;
    @Mock BalanceSnapshotRepository balanceSnapshotRepository;

    AccountService service;

    @BeforeEach
    void setUp() {
        service = new AccountService(accountRepository, institutionRepository, balanceSnapshotRepository);
    }

    private Account account(Institution.ConnectorType connectorType) {
        Institution institution = Institution.builder().id(1L).name("SwissLife").connectorType(connectorType).build();
        return Account.builder().id(10L).institution(institution).label("AV").type(Account.AccountType.LIFE_INSURANCE)
                .currentBalance(new BigDecimal("100.00")).build();
    }

    @Test
    void updateManualBalance_setsCurrentBalanceAndWritesSnapshot() {
        Account account = account(Institution.ConnectorType.MANUAL);
        when(accountRepository.findById(10L)).thenReturn(Optional.of(account));
        when(accountRepository.save(account)).thenReturn(account);

        var dto = service.updateManualBalance(10L, new UpdateBalanceRequest(new BigDecimal("1234.56"), null));

        assertThat(dto.currentBalance()).isEqualByComparingTo("1234.56");
        assertThat(account.getLastSyncedAt()).isNotNull();
        ArgumentCaptor<BalanceSnapshot> snapshot = ArgumentCaptor.forClass(BalanceSnapshot.class);
        verify(balanceSnapshotRepository).save(snapshot.capture());
        assertThat(snapshot.getValue().getBalance()).isEqualByComparingTo("1234.56");
    }

    @Test
    void updateManualBalance_backdatedBeforeLatestSnapshot_onlyWritesHistory() {
        Account account = account(Institution.ConnectorType.MANUAL);
        when(accountRepository.findById(10L)).thenReturn(Optional.of(account));
        when(balanceSnapshotRepository.existsByAccountIdAndRecordedAtAfter(eq(10L), any())).thenReturn(true);

        LocalDate past = LocalDate.now().minusDays(30);
        service.updateManualBalance(10L, new UpdateBalanceRequest(new BigDecimal("50.00"), past));

        assertThat(account.getCurrentBalance()).isEqualByComparingTo("100.00");
        verify(accountRepository, never()).save(any());
        ArgumentCaptor<BalanceSnapshot> snapshot = ArgumentCaptor.forClass(BalanceSnapshot.class);
        verify(balanceSnapshotRepository).save(snapshot.capture());
        assertThat(snapshot.getValue().getRecordedAt()).isEqualTo(past.atStartOfDay());
    }

    @Test
    void updateManualBalance_nonManualAccount_isRejected() {
        when(accountRepository.findById(10L)).thenReturn(Optional.of(account(Institution.ConnectorType.WOOB)));

        assertThatThrownBy(() -> service.updateManualBalance(10L, new UpdateBalanceRequest(BigDecimal.ONE, null)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(balanceSnapshotRepository, never()).save(any());
    }

    @Test
    void updateManualBalance_unknownAccount_is404() {
        when(accountRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateManualBalance(99L, new UpdateBalanceRequest(BigDecimal.ONE, null)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void createManualAccount_createsAccountWithInitialSnapshot() {
        Institution institution = Institution.builder().id(1L).name("SwissLife")
                .connectorType(Institution.ConnectorType.MANUAL).build();
        when(institutionRepository.findById(1L)).thenReturn(Optional.of(institution));
        when(accountRepository.save(any(Account.class))).thenAnswer(inv -> {
            Account a = inv.getArgument(0);
            a.setId(11L);
            return a;
        });

        var dto = service.createManualAccount(1L, new CreateManualAccountRequest(
                " Contrat AV ", Account.AccountType.LIFE_INSURANCE, null, new BigDecimal("5000.00"), null));

        assertThat(dto.label()).isEqualTo("Contrat AV");
        assertThat(dto.currency()).isEqualTo("EUR");
        assertThat(dto.currentBalance()).isEqualByComparingTo("5000.00");
        verify(balanceSnapshotRepository).save(any(BalanceSnapshot.class));
    }

    @Test
    void createManualAccount_nonManualInstitution_isRejected() {
        Institution institution = Institution.builder().id(2L).name("BNP")
                .connectorType(Institution.ConnectorType.WOOB).build();
        when(institutionRepository.findById(2L)).thenReturn(Optional.of(institution));

        assertThatThrownBy(() -> service.createManualAccount(2L, new CreateManualAccountRequest(
                "x", Account.AccountType.CHECKING, "EUR", BigDecimal.ONE, null)))
                .isInstanceOf(ResponseStatusException.class);
        verify(accountRepository, never()).save(any());
    }

    @Test
    void netWorthHistory_sumsLatestBalancePerAccountCarriedForward() {
        Account a = account(Institution.ConnectorType.MANUAL);
        Account b = account(Institution.ConnectorType.MANUAL);
        b.setId(11L);
        when(balanceSnapshotRepository.findAllActiveOrderByRecordedAtAsc()).thenReturn(java.util.List.of(
                snapshot(a, "100.00", LocalDate.of(2024, 1, 1).atTime(8, 0)),
                snapshot(a, "120.00", LocalDate.of(2024, 1, 1).atTime(18, 0)),
                snapshot(b, "50.00", LocalDate.of(2024, 1, 3).atStartOfDay()),
                snapshot(a, "130.00", LocalDate.of(2024, 1, 5).atStartOfDay())));

        var points = service.netWorthHistory();

        assertThat(points).hasSize(3);
        assertThat(points.get(0).date()).isEqualTo(LocalDate.of(2024, 1, 1));
        assertThat(points.get(0).total()).isEqualByComparingTo("120.00");
        assertThat(points.get(1).total()).isEqualByComparingTo("170.00");
        assertThat(points.get(2).total()).isEqualByComparingTo("180.00");
    }

    @Test
    void netWorthHistory_noSnapshots_isEmpty() {
        assertThat(service.netWorthHistory()).isEmpty();
    }

    private BalanceSnapshot snapshot(Account account, String balance, java.time.LocalDateTime at) {
        return BalanceSnapshot.builder().account(account).balance(new BigDecimal(balance)).recordedAt(at).build();
    }
}
