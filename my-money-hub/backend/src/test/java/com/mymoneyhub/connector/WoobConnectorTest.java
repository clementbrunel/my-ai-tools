package com.mymoneyhub.connector;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mymoneyhub.config.WoobProperties;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.Institution;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Fixtures mirror what woob 3.7 prints for {@code bank -f json list/history} (Account/Transaction
 * {@code to_dict()} through {@code WoobEncoder}), trimmed to the fields that matter.
 */
class WoobConnectorTest {

    private static final String ACCOUNTS_JSON = """
            [
             {"id": "12345678901@bnp", "url": null, "label": "Compte de chèques", "currency": "EUR",
              "type": 1, "balance": "1234.56", "coming": null, "iban": "FR7630004000031234567890143"},
             {"id": "4974XXXX1234@bnp", "label": "Carte Visa", "currency": "EUR", "type": 7,
              "balance": "-42.10", "iban": null},
             {"id": "98765432100@bnp", "label": "Livret A", "currency": "EUR", "type": 28,
              "balance": "15000.00", "iban": null},
             {"id": "LV01@bnp", "label": "Assurance vie", "currency": null, "type": 8,
              "balance": null, "iban": null}
            ]
            """;

    private static final String HISTORY_JSON = """
            [
             {"id": "@bnp", "date": "2026-10-01", "rdate": "2026-09-30", "type": 7,
              "raw": "FACTURE CARTE DU 300926 CARREFOUR", "label": "CARREFOUR", "amount": "-12.50"},
             {"id": "@bnp", "date": "2026-10-01", "rdate": "2026-09-30", "type": 7,
              "raw": "FACTURE CARTE DU 300926 CARREFOUR", "label": "CARREFOUR", "amount": "-12.50"},
             {"id": "TX42@bnp", "date": "2026-09-15", "type": 1, "raw": null,
              "label": "VIR SEPA SALAIRE", "amount": "2500.00"},
             {"id": "@bnp", "date": null, "rdate": "2026-09-10", "raw": "PRLV EDF", "amount": "-80"},
             {"id": "@bnp", "date": "2026-06-01", "raw": "TOO OLD", "amount": "-1.00"}
            ]
            """;

    private final ObjectMapper mapper = new ObjectMapper();
    private final WoobConnector connector = new WoobConnector(new WoobProperties("woob", null));

    @Test
    void parsesAccountsAsPrintedByWoob() throws IOException {
        List<FetchedAccount> accounts = connector.parseAccounts(mapper.readTree(ACCOUNTS_JSON));

        assertThat(accounts).extracting(FetchedAccount::externalAccountId)
                .containsExactly("12345678901@bnp", "4974XXXX1234@bnp", "98765432100@bnp", "LV01@bnp");
        assertThat(accounts).extracting(FetchedAccount::type).containsExactly(
                Account.AccountType.CHECKING, Account.AccountType.CARD,
                Account.AccountType.SAVINGS, Account.AccountType.LIFE_INSURANCE);
        assertThat(accounts.get(0).currentBalance()).isEqualByComparingTo("1234.56");
        assertThat(accounts.get(0).iban()).isEqualTo("FR7630004000031234567890143");
        assertThat(accounts.get(1).iban()).isNull();
        assertThat(accounts.get(3).currency()).isEqualTo("EUR");
        assertThat(accounts.get(3).currentBalance()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void parsesHistoryWithStableIdsWhenModuleGivesNone() throws IOException {
        LocalDate since = LocalDate.of(2026, 7, 12);
        List<FetchedTransaction> first = connector.parseTransactions(
                mapper.readTree(HISTORY_JSON), "12345678901@bnp", "EUR", since);
        List<FetchedTransaction> second = connector.parseTransactions(
                mapper.readTree(HISTORY_JSON), "12345678901@bnp", "EUR", since);

        assertThat(first).hasSize(4);
        assertThat(first).extracting(FetchedTransaction::externalId).doesNotHaveDuplicates().doesNotContainNull();
        assertThat(first).extracting(FetchedTransaction::externalId)
                .containsExactlyElementsOf(second.stream().map(FetchedTransaction::externalId).toList());
        assertThat(first.get(0).externalId()).startsWith(WoobConnector.SYNTHETIC_ID_PREFIX);
        assertThat(first.get(0).amount()).isEqualByComparingTo("-12.50");
        assertThat(first.get(0).description()).isEqualTo("FACTURE CARTE DU 300926 CARREFOUR");

        FetchedTransaction salary = first.get(2);
        assertThat(salary.externalId()).isEqualTo("TX42@bnp");
        assertThat(salary.description()).isEqualTo("VIR SEPA SALAIRE");
        assertThat(salary.currency()).isEqualTo("EUR");

        assertThat(first.get(3).bookingDate()).isEqualTo(LocalDate.of(2026, 9, 10));
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    void invokesWoobWithBackendSelectorAndNoResultCap(@TempDir Path dir) throws IOException {
        Path argsFile = dir.resolve("args");
        Path fake = fakeWoob(dir, """
                echo "$@" > %s
                echo '[{"id": "1@bnp", "label": "CC", "currency": "EUR", "type": 1, "balance": "10.00"}]'
                """.formatted(argsFile));
        WoobConnector real = new WoobConnector(new WoobProperties(fake.toString(), Duration.ofSeconds(10)));
        Institution bnp = Institution.builder().externalRef("bnp").build();

        assertThat(real.fetchAccounts(bnp)).hasSize(1);
        assertThat(Files.readString(argsFile).strip()).isEqualTo("bank -b bnp -f json -n 0 list");

        Account account = Account.builder().externalAccountId("1@bnp").currency("EUR").build();
        real.fetchTransactions(bnp, account, LocalDate.of(2026, 7, 12));
        assertThat(Files.readString(argsFile).strip())
                .isEqualTo("bank -b bnp -f json -n 0 history 1@bnp 2026-07-12");
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    void backendErrorOnStderrFailsEvenWithExitZero(@TempDir Path dir) throws IOException {
        // Shape captured from woob 3.7 + bnp module when the site is unreachable.
        Path fake = fakeWoob(dir, """
                echo '2026-10-12 22:55:01,788:WARNING:urllib3.connectionpool:3.7:connectionpool.py:874:urlopen Retrying' >&2
                echo 'Error(bnp): Wrong login or password' >&2
                echo 'Use --debug option to print backtraces' >&2
                echo '[]'
                """);
        WoobConnector real = new WoobConnector(new WoobProperties(fake.toString(), Duration.ofSeconds(10)));

        assertThatThrownBy(() -> real.fetchAccounts(Institution.builder().externalRef("bnp").build()))
                .isInstanceOf(WoobConnector.WoobExecutionException.class)
                .hasMessageContaining("Wrong login or password");
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    void unknownBackendMessageOnStdoutIsReported(@TempDir Path dir) throws IOException {
        // What woob 3.7 really does for an unknown `-b`: interactive menu on stdout, exit 0.
        Path fake = fakeWoob(dir, """
                echo 'There is currently no configured backend for bank'
                echo ''
                echo 'Available modules:'
                echo ' 13) [ ] bnp                 BNP Paribas'
                printf 'Select a backend to create: '
                """);
        WoobConnector real = new WoobConnector(new WoobProperties(fake.toString(), Duration.ofSeconds(10)));

        assertThatThrownBy(() -> real.fetchAccounts(Institution.builder().externalRef("bnp").build()))
                .isInstanceOf(WoobConnector.WoobExecutionException.class)
                .hasMessageContaining("no configured backend");
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    void hungProcessTimesOut(@TempDir Path dir) throws IOException {
        Path fake = fakeWoob(dir, "sleep 30\n");
        WoobConnector real = new WoobConnector(new WoobProperties(fake.toString(), Duration.ofMillis(500)));

        assertThatThrownBy(() -> real.fetchAccounts(Institution.builder().externalRef("bnp").build()))
                .isInstanceOf(WoobConnector.WoobExecutionException.class)
                .hasMessageContaining("timed out");
    }

    private static Path fakeWoob(Path dir, String body) throws IOException {
        Path script = dir.resolve("woob");
        Files.writeString(script, "#!/bin/sh\n" + body);
        script.toFile().setExecutable(true);
        return script;
    }
}
