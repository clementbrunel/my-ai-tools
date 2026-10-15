package com.mymoneyhub.connector;

import com.mymoneyhub.config.WoobProperties;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.Institution;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Real sync against a configured woob backend — skipped unless {@code WOOB_LIVE_BACKEND} is set.
 * Hits the bank's site with the credentials stored by {@code woob config add bnp}:
 * <pre>
 *   WOOB_LIVE_BACKEND=bnp mvn test -Dtest=WoobConnectorLiveTest
 * </pre>
 * Optional: {@code WOOB_BINARY_PATH} (default {@code woob}).
 */
@EnabledIfEnvironmentVariable(named = "WOOB_LIVE_BACKEND", matches = ".+")
class WoobConnectorLiveTest {

    @Test
    void syncsAccountsAndTransactions() {
        WoobConnector connector = new WoobConnector(new WoobProperties(System.getenv("WOOB_BINARY_PATH"), null));
        Institution institution = Institution.builder().externalRef(System.getenv("WOOB_LIVE_BACKEND")).build();
        LocalDate since = LocalDate.now().minusMonths(3);

        List<FetchedAccount> accounts = connector.fetchAccounts(institution);
        assertThat(accounts).isNotEmpty();
        assertThat(accounts).allSatisfy(a -> {
            assertThat(a.externalAccountId()).isNotBlank();
            assertThat(a.currentBalance()).isNotNull();
        });

        for (FetchedAccount fetched : accounts) {
            System.out.printf("%s | %s | %s | %s %s%n", fetched.externalAccountId(), fetched.label(),
                    fetched.type(), fetched.currentBalance(), fetched.currency());
            Account account = Account.builder()
                    .externalAccountId(fetched.externalAccountId())
                    .currency(fetched.currency())
                    .build();
            List<FetchedTransaction> transactions = connector.fetchTransactions(institution, account, since);
            assertThat(transactions).extracting(FetchedTransaction::externalId).doesNotHaveDuplicates();
            assertThat(transactions).allSatisfy(t -> assertThat(t.bookingDate()).isAfterOrEqualTo(since));
            transactions.stream().limit(5).forEach(t -> System.out.printf("    %s %s %s [%s]%n",
                    t.bookingDate(), t.amount(), t.description(), t.externalId()));
            System.out.printf("    … %d transactions since %s%n", transactions.size(), since);
        }
    }
}
