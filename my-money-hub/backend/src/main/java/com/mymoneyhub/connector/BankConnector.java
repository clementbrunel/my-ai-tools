package com.mymoneyhub.connector;

import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.Institution;

import java.time.LocalDate;
import java.util.List;

/** One implementation per {@link Institution.ConnectorType} — {@link com.mymoneyhub.service.SyncService}
 *  picks the right one for each institution and never talks to a bank's site/API directly. */
public interface BankConnector {

    Institution.ConnectorType supports();

    List<FetchedAccount> fetchAccounts(Institution institution);

    List<FetchedTransaction> fetchTransactions(Institution institution, Account account, LocalDate since);
}
