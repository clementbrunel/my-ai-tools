package com.mymoneyhub.service;

import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.DataSource;
import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.repository.AccountRepository;
import com.mymoneyhub.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountMergeServiceTest {

    @Mock AccountRepository accountRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock ImportService importService;
    @Mock AccountService accountService;
    @Mock JdbcTemplate jdbc;

    AccountMergeService service;

    @BeforeEach
    void setUp() {
        service = new AccountMergeService(accountRepository, transactionRepository, importService, accountService, jdbc);
    }

    private Account account(long id, Institution.ConnectorType type, boolean archived) {
        Institution institution = Institution.builder().id(id).name("Bank" + id).connectorType(type).build();
        return Account.builder().id(id).institution(institution).label("Compte").type(Account.AccountType.CHECKING)
                .currentBalance(new BigDecimal("10.00")).archived(archived).build();
    }

    @Test
    void merge_keepsTheSyncedAccountAndDropsTheImportedOne() {
        Account imported = account(1, Institution.ConnectorType.MANUAL, true);
        Account synced = account(2, Institution.ConnectorType.ENABLE_BANKING, false);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(imported));
        when(accountRepository.findById(2L)).thenReturn(Optional.of(synced));
        when(transactionRepository.findFirstBookingDate(2L, DataSource.SYNC)).thenReturn(LocalDate.of(2025, 3, 1));

        service.merge(1L, 2L);

        verify(jdbc).update(any(String.class), eq(2L), eq(1L), eq(java.sql.Date.valueOf("2025-03-01")));
        verify(jdbc).update("UPDATE transactions SET account_id = ? WHERE account_id = ?", 2L, 1L);
        verify(jdbc).update("UPDATE balance_snapshots SET account_id = ? WHERE account_id = ?", 2L, 1L);
        verify(importService).rebuildBalanceHistory(synced, false);
        verify(jdbc).update("DELETE FROM accounts WHERE id = ?", 1L);
        assertThat(synced.isArchived()).isFalse();
    }

    @Test
    void merge_inverseDirectionKeepsTheSyncedAccountToo() {
        Account synced = account(2, Institution.ConnectorType.ENABLE_BANKING, false);
        Account imported = account(1, Institution.ConnectorType.MANUAL, true);
        when(accountRepository.findById(2L)).thenReturn(Optional.of(synced));
        when(accountRepository.findById(1L)).thenReturn(Optional.of(imported));

        service.merge(2L, 1L);

        verify(jdbc).update("DELETE FROM accounts WHERE id = ?", 1L);
        verify(importService).rebuildBalanceHistory(synced, false);
    }

    @Test
    void merge_rejectsSelfMerge() {
        assertThatThrownBy(() -> service.merge(1L, 1L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verifyNoInteractions(jdbc);
    }

    @Test
    void merge_rejectsDifferentCurrencies() {
        Account a = account(1, Institution.ConnectorType.MANUAL, true);
        Account b = account(2, Institution.ConnectorType.ENABLE_BANKING, false);
        b.setCurrency("USD");
        when(accountRepository.findById(1L)).thenReturn(Optional.of(a));
        when(accountRepository.findById(2L)).thenReturn(Optional.of(b));

        assertThatThrownBy(() -> service.merge(1L, 2L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(jdbc, never()).update(any(String.class), any(Object[].class));
    }
}
