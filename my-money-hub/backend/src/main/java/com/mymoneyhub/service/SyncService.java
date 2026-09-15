package com.mymoneyhub.service;

import com.mymoneyhub.connector.BankConnector;
import com.mymoneyhub.connector.FetchedAccount;
import com.mymoneyhub.connector.FetchedTransaction;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.BalanceSnapshot;
import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.entity.Transaction;
import com.mymoneyhub.repository.AccountRepository;
import com.mymoneyhub.repository.BalanceSnapshotRepository;
import com.mymoneyhub.repository.InstitutionRepository;
import com.mymoneyhub.repository.TransactionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SyncService {

    private final InstitutionRepository institutionRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final BalanceSnapshotRepository balanceSnapshotRepository;
    private final Map<Institution.ConnectorType, BankConnector> connectorsByType;

    public SyncService(InstitutionRepository institutionRepository,
                        AccountRepository accountRepository,
                        TransactionRepository transactionRepository,
                        BalanceSnapshotRepository balanceSnapshotRepository,
                        List<BankConnector> connectors) {
        this.institutionRepository = institutionRepository;
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.balanceSnapshotRepository = balanceSnapshotRepository;
        this.connectorsByType = connectors.stream()
                .collect(Collectors.toMap(BankConnector::supports, Function.identity()));
    }

    public void syncAll() {
        institutionRepository.findAll().forEach(this::syncInstitution);
    }

    @Transactional
    public void syncInstitution(Institution institution) {
        BankConnector connector = connectorsByType.get(institution.getConnectorType());
        if (connector == null) {
            log.warn("No connector registered for {}, skipping institution {}",
                    institution.getConnectorType(), institution.getName());
            return;
        }

        for (FetchedAccount fetched : connector.fetchAccounts(institution)) {
            Account account = accountRepository
                    .findByExternalAccountIdAndInstitutionId(fetched.externalAccountId(), institution.getId())
                    .stream().findFirst()
                    .orElseGet(() -> Account.builder()
                            .institution(institution)
                            .externalAccountId(fetched.externalAccountId())
                            .build());

            account.setLabel(fetched.label());
            account.setIban(fetched.iban());
            account.setCurrency(fetched.currency());
            account.setType(fetched.type());
            account.setCurrentBalance(fetched.currentBalance());
            account.setLastSyncedAt(LocalDateTime.now());
            account = accountRepository.save(account);

            balanceSnapshotRepository.save(BalanceSnapshot.builder()
                    .account(account)
                    .balance(fetched.currentBalance())
                    .build());

            syncTransactions(institution, connector, account);
        }
    }

    private void syncTransactions(Institution institution, BankConnector connector, Account account) {
        LocalDate since = LocalDate.now().minusMonths(3);
        for (FetchedTransaction fetched : connector.fetchTransactions(institution, account, since)) {
            if (fetched.externalId() != null &&
                    transactionRepository.findByAccountIdAndExternalId(account.getId(), fetched.externalId()).isPresent()) {
                continue;
            }
            transactionRepository.save(Transaction.builder()
                    .account(account)
                    .bookingDate(fetched.bookingDate())
                    .amount(fetched.amount())
                    .currency(fetched.currency())
                    .description(fetched.description())
                    .externalId(fetched.externalId())
                    .build());
        }
    }
}
