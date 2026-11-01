package com.mymoneyhub.service;

import com.mymoneyhub.dto.AccountDto;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.DataSource;
import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.repository.AccountRepository;
import com.mymoneyhub.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

/**
 * Merges two accounts into one — typically a Linxo-imported account (institution {@code MANUAL}, history only)
 * with the account a connector later synchronised for the same bank account.
 * <ul>
 *   <li>The survivor is the account of a synced institution (non-MANUAL); when both or neither are, the target.</li>
 *   <li>Transactions and balance snapshots move to the survivor; the sync wins on the overlap: LINXO transactions
 *       dated on/after the first SYNC transaction are dropped.</li>
 *   <li>LINXO month-end snapshots are rebuilt, anchored on the survivor's synced balance.</li>
 *   <li>The other account is deleted.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountMergeService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final ImportService importService;
    private final AccountService accountService;
    private final JdbcTemplate jdbc;

    @Transactional
    public AccountDto merge(Long accountId, Long targetId) {
        if (accountId.equals(targetId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot merge an account with itself");
        }
        Account first = find(accountId);
        Account second = find(targetId);
        if (!first.getCurrency().equals(second.getCurrency())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Accounts have different currencies");
        }

        boolean firstSynced = isSynced(first);
        boolean secondSynced = isSynced(second);
        Account survivor = firstSynced && !secondSynced ? first : second;
        Account absorbed = survivor == first ? second : first;
        Long keep = survivor.getId();
        Long drop = absorbed.getId();

        // The sync wins: LINXO rows from the first SYNC transaction (of either account) onwards are redundant.
        LocalDate syncStart = earliest(transactionRepository.findFirstBookingDate(keep, DataSource.SYNC),
                transactionRepository.findFirstBookingDate(drop, DataSource.SYNC));
        if (syncStart != null) {
            jdbc.update("DELETE FROM transactions WHERE account_id IN (?, ?) AND source = 'LINXO' AND booking_date >= ?",
                    keep, drop, java.sql.Date.valueOf(syncStart));
        }
        // Rows already present on the survivor (same external id) are not moved: the unique index would reject them.
        jdbc.update("""
                DELETE FROM transactions t WHERE t.account_id = ? AND t.external_id IS NOT NULL
                AND EXISTS (SELECT 1 FROM transactions k WHERE k.account_id = ? AND k.external_id = t.external_id)
                """, drop, keep);
        jdbc.update("UPDATE transactions SET account_id = ? WHERE account_id = ?", keep, drop);
        jdbc.update("UPDATE balance_snapshots SET account_id = ? WHERE account_id = ?", keep, drop);

        survivor.setArchived(first.isArchived() && second.isArchived());
        if (survivor.getIban() == null) {
            survivor.setIban(absorbed.getIban());
        }
        accountRepository.save(survivor);

        // Imported month ends are recomputed over the merged operations (old LINXO snapshots are replaced).
        importService.rebuildBalanceHistory(survivor, false);

        jdbc.update("DELETE FROM accounts WHERE id = ?", drop);
        log.info("Merged account {} into {}", drop, keep);
        return accountService.toDto(survivor);
    }

    /** Synced account = its institution has a real connector (the Linxo import files its accounts under MANUAL). */
    private static boolean isSynced(Account account) {
        return account.getInstitution().getConnectorType() != Institution.ConnectorType.MANUAL;
    }

    private static LocalDate earliest(LocalDate a, LocalDate b) {
        return a == null ? b : b == null ? a : a.isBefore(b) ? a : b;
    }

    private Account find(Long id) {
        return accountRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account " + id + " not found"));
    }
}
