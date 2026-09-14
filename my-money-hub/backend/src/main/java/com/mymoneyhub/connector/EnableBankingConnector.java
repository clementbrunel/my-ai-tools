package com.mymoneyhub.connector;

import com.mymoneyhub.config.EnableBankingProperties;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.Institution;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.util.List;

/**
 * Covers Boursorama, N26 and Revolut — confirmed integrated on Enable Banking's ASPSP directory
 * (enablebanking.com/open-banking-apis). Runs against their free "Restricted Production" tier
 * (accounts you link yourself, non-commercial use — see enablebanking.com/docs/faq).
 * <p>
 * NOT IMPLEMENTED YET: the actual JWT-signed request flow (application-id + private key),
 * the consent/authorization redirect, and the accounts/transactions endpoint shapes are not
 * wired in — their exact contract needs to come from enablebanking.com/docs/api against a real
 * sandbox application, not be guessed here. {@link #enableBankingRestClient} is already
 * configured with the base URL from {@link EnableBankingProperties} as the starting point.
 */
@Component
@RequiredArgsConstructor
public class EnableBankingConnector implements BankConnector {

    private final RestClient enableBankingRestClient;
    private final EnableBankingProperties properties;

    @Override
    public Institution.ConnectorType supports() {
        return Institution.ConnectorType.ENABLE_BANKING;
    }

    @Override
    public List<FetchedAccount> fetchAccounts(Institution institution) {
        throw new UnsupportedOperationException(
                "Enable Banking auth flow not implemented yet — see class javadoc and " +
                        "https://enablebanking.com/docs/api/");
    }

    @Override
    public List<FetchedTransaction> fetchTransactions(Institution institution, Account account, LocalDate since) {
        throw new UnsupportedOperationException(
                "Enable Banking auth flow not implemented yet — see class javadoc and " +
                        "https://enablebanking.com/docs/api/");
    }
}
