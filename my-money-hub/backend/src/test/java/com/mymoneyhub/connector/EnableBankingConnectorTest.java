package com.mymoneyhub.connector;

import com.mymoneyhub.config.EnableBankingProperties;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.Institution;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class EnableBankingConnectorTest {

    @TempDir
    Path tempDir;

    private KeyPair keyPair;
    private MockRestServiceServer server;
    private EnableBankingConnector connector;
    private EnableBankingJwtSigner signer;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        keyPair = generator.generateKeyPair();
        Path keyFile = tempDir.resolve("key.pem");
        Files.writeString(keyFile, "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder().encodeToString(keyPair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----\n");

        EnableBankingProperties props = new EnableBankingProperties("https://api.enablebanking.com", "app-123",
                keyFile.toString(), "http://localhost:3001/api/enable-banking/callback", "http://localhost:3001/", 90);
        signer = new EnableBankingJwtSigner(props);
        RestClient.Builder builder = RestClient.builder().baseUrl(props.baseUrl())
                .requestInterceptor((request, body, execution) -> {
                    request.getHeaders().setBearerAuth(signer.token());
                    return execution.execute(request, body);
                });
        server = MockRestServiceServer.bindTo(builder).build();
        connector = new EnableBankingConnector(builder.build(), props);
    }

    @Test
    void jwtIsSignedWithApplicationKey() throws Exception {
        String[] parts = signer.token().split("\\.");
        String header = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
        String claims = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        assertThat(header).contains("\"alg\":\"RS256\"", "\"kid\":\"app-123\"");
        assertThat(claims).contains("\"iss\":\"enablebanking.com\"", "\"aud\":\"api.enablebanking.com\"");

        Signature verifier = Signature.getInstance("SHA256withRSA");
        verifier.initVerify(keyPair.getPublic());
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verifier.verify(Base64.getUrlDecoder().decode(parts[2]))).isTrue();
    }

    @Test
    void fetchesAccountsAndPaginatedTransactions() {
        Institution institution = Institution.builder().id(1L).name("Boursorama").externalRef("Boursorama")
                .externalSessionId("sess-1").sessionValidUntil(LocalDateTime.now().plusDays(10)).build();

        server.expect(requestTo("https://api.enablebanking.com/sessions/sess-1"))
                .andExpect(header("Authorization", org.hamcrest.Matchers.startsWith("Bearer ey")))
                .andRespond(json("""
                        {"status":"AUTHORIZED","accounts":["uid-1"],
                         "accounts_data":[{"uid":"uid-1","identification_hash":"hash-1"}]}"""));
        server.expect(requestTo("https://api.enablebanking.com/accounts/uid-1/details"))
                .andRespond(json("""
                        {"uid":"uid-1","account_id":{"iban":"FR7600000000000000000000001"},
                         "name":"Compte courant","currency":"EUR","cash_account_type":"CACC"}"""));
        server.expect(requestTo("https://api.enablebanking.com/accounts/uid-1/balances"))
                .andRespond(json("""
                        {"balances":[
                          {"balance_amount":{"currency":"EUR","amount":"10.00"},"balance_type":"ITAV"},
                          {"balance_amount":{"currency":"EUR","amount":"1234.56"},"balance_type":"CLBD"}]}"""));

        server.expect(requestTo("https://api.enablebanking.com/accounts/uid-1/transactions?date_from=2026-07-01"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(json("""
                        {"transactions":[
                          {"entry_reference":"tx-1","transaction_amount":{"currency":"EUR","amount":"42.50"},
                           "credit_debit_indicator":"DBIT","status":"BOOK","booking_date":"2026-07-03",
                           "remittance_information":["CB CARREFOUR"]},
                          {"entry_reference":"tx-p","transaction_amount":{"currency":"EUR","amount":"5"},
                           "credit_debit_indicator":"DBIT","status":"PDNG","booking_date":"2026-07-04"}],
                         "continuation_key":"next"}"""));
        server.expect(requestTo("https://api.enablebanking.com/accounts/uid-1/transactions?date_from=2026-07-01&continuation_key=next"))
                .andRespond(json("""
                        {"transactions":[
                          {"transaction_amount":{"currency":"EUR","amount":"2000"},"credit_debit_indicator":"CRDT",
                           "status":"BOOK","booking_date":"2026-07-05","debtor":{"name":"EMPLOYEUR"}}]}"""));

        List<FetchedAccount> accounts = connector.fetchAccounts(institution);
        assertThat(accounts).singleElement().satisfies(a -> {
            assertThat(a.externalAccountId()).isEqualTo("hash-1");
            assertThat(a.label()).isEqualTo("Compte courant");
            assertThat(a.iban()).isEqualTo("FR7600000000000000000000001");
            assertThat(a.type()).isEqualTo(Account.AccountType.CHECKING);
            assertThat(a.currentBalance()).isEqualByComparingTo("1234.56");
        });

        Account account = Account.builder().externalAccountId("hash-1").label("Compte courant").build();
        List<FetchedTransaction> transactions =
                connector.fetchTransactions(institution, account, LocalDate.of(2026, 7, 1));

        assertThat(transactions).hasSize(2);
        assertThat(transactions.get(0).externalId()).isEqualTo("tx-1");
        assertThat(transactions.get(0).amount()).isEqualByComparingTo(new BigDecimal("-42.50"));
        assertThat(transactions.get(0).description()).isEqualTo("CB CARREFOUR");
        assertThat(transactions.get(1).externalId()).startsWith("h:");
        assertThat(transactions.get(1).amount()).isEqualByComparingTo("2000");
        assertThat(transactions.get(1).description()).isEqualTo("EMPLOYEUR");
        server.verify();
    }

    @Test
    void refusesToSyncWithoutSession() {
        Institution institution = Institution.builder().id(7L).name("N26").externalRef("N26").build();
        assertThatThrownBy(() -> connector.fetchAccounts(institution))
                .isInstanceOf(EnableBankingException.class)
                .hasMessageContaining("/api/institutions/7/connect");
    }

    private static org.springframework.test.web.client.ResponseCreator json(String body) {
        return withSuccess(body, MediaType.APPLICATION_JSON);
    }
}
