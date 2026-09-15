package com.mymoneyhub.connector;

import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.Institution;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/** For institutions with no automated connector yet (Mon Petit Placement, SwissLife, Foyer,
 *  AFI-ESCA) — balances are entered by hand through the UI, sync is a no-op rather than an error. */
@Component
public class ManualConnector implements BankConnector {

    @Override
    public Institution.ConnectorType supports() {
        return Institution.ConnectorType.MANUAL;
    }

    @Override
    public List<FetchedAccount> fetchAccounts(Institution institution) {
        return List.of();
    }

    @Override
    public List<FetchedTransaction> fetchTransactions(Institution institution, Account account, LocalDate since) {
        return List.of();
    }
}
