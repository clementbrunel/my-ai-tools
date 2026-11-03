package com.mymoneyhub.service;

import com.mymoneyhub.dto.LinxoAccountChoice;
import com.mymoneyhub.dto.LinxoAccountChoice.Action;
import com.mymoneyhub.dto.LinxoImportReport;
import com.mymoneyhub.dto.LinxoImportReport.AccountReport;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.DataSource;
import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.importer.BalanceHistoryCalculator;
import com.mymoneyhub.importer.BalanceHistoryCalculator.Operation;
import com.mymoneyhub.importer.BalanceHistoryCalculator.Point;
import com.mymoneyhub.importer.LinxoCsvParser;
import com.mymoneyhub.importer.LinxoRow;
import com.mymoneyhub.repository.AccountRepository;
import com.mymoneyhub.repository.BalanceSnapshotRepository;
import com.mymoneyhub.repository.InstitutionRepository;
import com.mymoneyhub.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Imports the history of a Linxo CSV export (one file mixes many accounts, grouped by
 * {@code (Nom de la connexion, Nom du compte)}).
 * <ul>
 *   <li>Transactions are deduplicated on a synthetic {@code external_id}, so re-importing is idempotent.</li>
 *   <li>The connector sync wins on the overlap: Linxo rows dated on/after the account's first synced
 *       transaction are skipped.</li>
 *   <li>The export has no balance: month-end {@code balance_snapshots} are rebuilt from the operations, anchored
 *       on the synced current balance when there is one, otherwise cumulated from 0 (relative).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ImportService {

    private static final int BATCH_SIZE = 500;
    private static final String INSERT_TRANSACTION = """
            INSERT INTO transactions (account_id, booking_date, amount, currency, description, category,
                                      external_id, source, created_at)
            VALUES (?, ?, ?, 'EUR', ?, ?, ?, 'LINXO', now())
            """;
    private static final String INSERT_SNAPSHOT = """
            INSERT INTO balance_snapshots (account_id, balance, recorded_at, source) VALUES (?, ?, ?, 'LINXO')
            """;

    private final LinxoCsvParser parser;
    private final InstitutionRepository institutionRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final BalanceSnapshotRepository balanceSnapshotRepository;
    private final JdbcTemplate jdbc;

    private record GroupKey(String connection, String account) {
    }

    private record NewTransaction(LocalDate date, BigDecimal amount, String description, String category, String externalId) {
    }

    @Transactional
    public LinxoImportReport importLinxo(byte[] file, boolean dryRun, List<LinxoAccountChoice> choices) {
        LinxoCsvParser.ParseResult parsed = parser.parse(file);

        Map<GroupKey, List<LinxoRow>> groups = new LinkedHashMap<>();
        for (LinxoRow row : parsed.rows()) {
            groups.computeIfAbsent(new GroupKey(row.connection(), row.account()), k -> new ArrayList<>()).add(row);
        }
        Map<GroupKey, LinxoAccountChoice> chosen = new HashMap<>();
        if (choices != null) {
            choices.forEach(c -> chosen.put(new GroupKey(c.connection() == null ? "" : c.connection().trim(),
                    c.account() == null ? "" : c.account().trim()), c));
        }

        List<Account> existingAccounts = accountRepository.findAll();
        Map<String, Institution> institutions = new HashMap<>();
        institutionRepository.findAll().forEach(i -> institutions.putIfAbsent(i.getName().toLowerCase(Locale.ROOT), i));

        List<AccountReport> reports = new ArrayList<>();
        for (Map.Entry<GroupKey, List<LinxoRow>> group : groups.entrySet()) {
            reports.add(importGroup(group.getKey(), group.getValue(), chosen.get(group.getKey()), existingAccounts,
                    institutions, dryRun));
        }

        LocalDate from = parsed.rows().stream().map(LinxoRow::date).min(Comparator.naturalOrder()).orElse(null);
        LocalDate to = parsed.rows().stream().map(LinxoRow::date).max(Comparator.naturalOrder()).orElse(null);
        return new LinxoImportReport(dryRun, parsed.rows().size() + parsed.rejected(), parsed.rejected(), parsed.errors(),
                from, to,
                reports.stream().mapToInt(AccountReport::imported).sum(),
                reports.stream().mapToInt(AccountReport::skippedDuplicate).sum(),
                reports.stream().mapToInt(AccountReport::skippedOverlap).sum(),
                reports);
    }

    private AccountReport importGroup(GroupKey key, List<LinxoRow> rows, LinxoAccountChoice choice,
                                      List<Account> existingAccounts, Map<String, Institution> institutions,
                                      boolean dryRun) {
        String externalAccountId = externalAccountId(key);
        Action action;
        Account target = null;
        if (choice != null) {
            action = choice.action();
            if (action == Action.LINK) {
                target = accountRepository.findById(choice.accountId() == null ? -1L : choice.accountId())
                        .orElseThrow(() -> new IllegalArgumentException("Compte introuvable pour " + key.account()));
            }
        } else {
            target = findExisting(key, externalAccountId, existingAccounts);
            action = target != null ? Action.LINK : Action.CREATE_ARCHIVED;
        }

        boolean created = false;
        if (target == null && !dryRun) {
            target = createAccount(key, externalAccountId, action == Action.CREATE_ARCHIVED, institutions);
            created = true;
        }

        Long accountId = target == null ? null : target.getId();
        LocalDate syncStartsOn = accountId == null ? null
                : transactionRepository.findFirstBookingDate(accountId, DataSource.SYNC);
        Set<String> knownIds = accountId == null ? Set.of()
                : transactionRepository.findExternalIds(accountId, DataSource.LINXO);

        List<NewTransaction> toInsert = new ArrayList<>();
        Map<String, Integer> occurrences = new HashMap<>();
        int duplicates = 0;
        int overlaps = 0;
        for (LinxoRow row : rows) {
            BigDecimal amount = row.amount().setScale(2, RoundingMode.HALF_UP);
            String description = description(row);
            String baseKey = row.date() + "|" + amount.toPlainString() + "|" + row.label() + "|" + row.notes();
            int occurrence = occurrences.merge(baseKey, 1, Integer::sum);
            String externalId = "linxo:" + sha256(key.connection() + "|" + key.account() + "|" + baseKey + "|" + occurrence)
                    .substring(0, 40);
            if (syncStartsOn != null && !row.date().isBefore(syncStartsOn)) {
                overlaps++;
            } else if (knownIds.contains(externalId)) {
                duplicates++;
            } else {
                toInsert.add(new NewTransaction(row.date(), amount, description,
                        truncate(row.category(), 100), externalId));
            }
        }

        int snapshots = 0;
        if (!dryRun) {
            insertTransactions(accountId, toInsert);
            snapshots = rebuildBalanceHistory(target, created);
        }

        BigDecimal total = rows.stream().map(LinxoRow::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new AccountReport(key.connection(), key.account(), rows.size(),
                rows.stream().map(LinxoRow::date).min(Comparator.naturalOrder()).orElse(null),
                rows.stream().map(LinxoRow::date).max(Comparator.naturalOrder()).orElse(null),
                total, action, accountId,
                target != null ? target.getInstitution().getName() + " — " + target.getLabel() : null,
                toInsert.size(), duplicates, overlaps, syncStartsOn, snapshots);
    }

    private Account findExisting(GroupKey key, String externalAccountId, List<Account> accounts) {
        return accounts.stream()
                .filter(a -> externalAccountId.equals(a.getExternalAccountId()))
                .findFirst()
                .orElseGet(() -> accounts.stream()
                        .filter(a -> a.getInstitution().getName().equalsIgnoreCase(key.connection())
                                && a.getLabel().equalsIgnoreCase(key.account()))
                        .findFirst()
                        .orElse(null));
    }

    private Account createAccount(GroupKey key, String externalAccountId, boolean archived,
                                  Map<String, Institution> institutions) {
        String connection = key.connection().isEmpty() ? "Linxo" : truncate(key.connection(), 100);
        Institution institution = institutions.computeIfAbsent(connection.toLowerCase(Locale.ROOT),
                name -> institutionRepository.save(Institution.builder()
                        .name(connection)
                        .type(Institution.InstitutionType.BANK)
                        .connectorType(Institution.ConnectorType.MANUAL)
                        .build()));
        return accountRepository.save(Account.builder()
                .institution(institution)
                .label(truncate(key.account(), 150))
                .type(guessType(key.account()))
                .externalAccountId(externalAccountId)
                .archived(archived)
                .build());
    }

    static Account.AccountType guessType(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.contains("assurance vie") || n.contains("assurance-vie")) {
            return Account.AccountType.LIFE_INSURANCE;
        }
        if (n.contains("livret") || n.contains("épargne") || n.contains("epargne") || n.matches(".*\\b(pel|cel|ldd|ldds|lep)\\b.*")) {
            return Account.AccountType.SAVINGS;
        }
        if (n.contains("pea") || n.contains("titres") || n.contains("bourse") || n.contains("invest")) {
            return Account.AccountType.INVESTMENT;
        }
        if (n.contains("carte")) {
            return Account.AccountType.CARD;
        }
        return Account.AccountType.CHECKING;
    }

    private void insertTransactions(Long accountId, List<NewTransaction> transactions) {
        if (transactions.isEmpty()) {
            return;
        }
        jdbc.batchUpdate(INSERT_TRANSACTION, transactions, BATCH_SIZE, (ps, t) -> {
            ps.setLong(1, accountId);
            ps.setDate(2, Date.valueOf(t.date()));
            ps.setBigDecimal(3, t.amount());
            ps.setString(4, t.description());
            ps.setString(5, t.category());
            ps.setString(6, t.externalId());
        });
    }

    /** Replaces the account's LINXO snapshots with month-end balances rebuilt from all its operations. */
    int rebuildBalanceHistory(Account account, boolean created) {
        List<Operation> operations = jdbc.query(
                "SELECT booking_date, amount FROM transactions WHERE account_id = ? ORDER BY booking_date",
                (rs, i) -> new Operation(rs.getDate(1).toLocalDate(), rs.getBigDecimal(2)), account.getId());

        if (created) {
            account.setCurrentBalance(operations.stream().map(Operation::amount).reduce(BigDecimal.ZERO, BigDecimal::add));
            accountRepository.save(account);
        }

        BigDecimal anchor = !created && account.getLastSyncedAt() != null ? account.getCurrentBalance() : null;
        LocalDateTime firstSnapshot = balanceSnapshotRepository.findEarliestRecordedAt(account.getId(), DataSource.SYNC);
        LocalDate before = firstSnapshot != null ? firstSnapshot.toLocalDate() : LocalDate.now();
        List<Point> points = BalanceHistoryCalculator.monthEnds(operations, anchor, before);

        balanceSnapshotRepository.deleteByAccountIdAndSource(account.getId(), DataSource.LINXO);
        if (!points.isEmpty()) {
            jdbc.batchUpdate(INSERT_SNAPSHOT, points, BATCH_SIZE, (ps, p) -> {
                ps.setLong(1, account.getId());
                ps.setBigDecimal(2, p.balance());
                ps.setTimestamp(3, Timestamp.valueOf(p.date().atTime(LocalTime.of(23, 59, 59))));
            });
        }
        log.info("Linxo import: account {} — {} operations, {} month-end snapshots", account.getId(), operations.size(), points.size());
        return points.size();
    }

    private static String description(LinxoRow row) {
        String label = row.label();
        String notes = row.notes();
        String text = notes.isEmpty() || notes.equalsIgnoreCase(label) ? label
                : label.isEmpty() ? notes : label + " | " + notes;
        return truncate(text, 500);
    }

    private static String externalAccountId(GroupKey key) {
        return "linxo:" + sha256(key.connection() + "|" + key.account()).substring(0, 32);
    }

    private static String truncate(String s, int max) {
        if (s == null || s.isEmpty()) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
