package com.mymoneyhub.connector;

import com.fasterxml.jackson.databind.JsonNode;
import com.mymoneyhub.config.EnableBankingProperties;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.Institution;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Covers Boursorama, N26 and Revolut — confirmed integrated on Enable Banking's ASPSP directory
 * (enablebanking.com/open-banking-apis). Runs against their free "Restricted Production" tier
 * (accounts you link yourself, non-commercial use — see enablebanking.com/docs/faq).
 * <p>
 * Flow (enablebanking.com/docs/api): {@code POST /auth} returns the bank's consent page
 * ({@link #startAuthorization}); the bank redirects back with a {@code code} that {@code POST /sessions}
 * exchanges for a session ({@link #createSession}), stored on the {@link Institution}. Syncs then read
 * {@code GET /sessions/{id}} for the account uids, and {@code /accounts/{uid}/details|balances|transactions}.
 * Requests are authenticated by {@link EnableBankingJwtSigner} (wired in {@code AppConfig}).
 * <p>
 * {@link Institution#getExternalRef()} holds the ASPSP name exactly as listed by {@code GET /aspsps}
 * (e.g. "Boursorama", "N26", "Revolut") and {@link Institution#getExternalCountry()} its country.
 * <p>
 * Account uids are per-session, so {@code externalAccountId} stores the account's stable
 * {@code identification_hash} instead — re-consenting doesn't duplicate accounts.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EnableBankingConnector implements BankConnector {

    static final String DEFAULT_COUNTRY = "FR";

    /** Preferred balance types, most meaningful first (ISO 20022 codes used by Enable Banking). */
    private static final List<String> BALANCE_TYPE_PRIORITY =
            List.of("CLBD", "ITBD", "XPCD", "ITAV", "CLAV", "OPBD", "OTHR");

    private final RestClient enableBankingRestClient;
    private final EnableBankingProperties properties;

    /** identification_hash → current session's account uid, refreshed by {@link #fetchAccounts}. */
    private final Map<String, String> accountUidByExternalId = new ConcurrentHashMap<>();

    @Override
    public Institution.ConnectorType supports() {
        return Institution.ConnectorType.ENABLE_BANKING;
    }

    @Override
    public List<FetchedAccount> fetchAccounts(Institution institution) {
        List<FetchedAccount> accounts = new ArrayList<>();
        for (Map.Entry<String, String> entry : resolveAccountUids(institution).entrySet()) {
            String externalId = entry.getKey();
            String uid = entry.getValue();
            JsonNode details = get("/accounts/{uid}/details", uid);
            JsonNode balances = get("/accounts/{uid}/balances", uid);
            JsonNode balance = pickBalance(balances.path("balances"));
            String currency = text(details.path("currency"),
                    text(balance.path("balance_amount").path("currency"), "EUR"));
            accounts.add(new FetchedAccount(
                    externalId,
                    accountLabel(institution, details),
                    text(details.path("account_id").path("iban"), null),
                    currency,
                    mapAccountType(text(details.path("cash_account_type"), "")),
                    new BigDecimal(text(balance.path("balance_amount").path("amount"), "0"))
            ));
        }
        return accounts;
    }

    @Override
    public List<FetchedTransaction> fetchTransactions(Institution institution, Account account, LocalDate since) {
        String uid = accountUidByExternalId.get(account.getExternalAccountId());
        if (uid == null) {
            uid = resolveAccountUids(institution).get(account.getExternalAccountId());
        }
        if (uid == null) {
            log.warn("Account {} is no longer part of {}'s Enable Banking session, skipping transactions",
                    account.getLabel(), institution.getName());
            return List.of();
        }

        List<FetchedTransaction> transactions = new ArrayList<>();
        String continuationKey = null;
        do {
            String key = continuationKey;
            String accountUid = uid;
            JsonNode page = call(() -> enableBankingRestClient.get()
                    .uri(builder -> {
                        builder.path("/accounts/{uid}/transactions").queryParam("date_from", since);
                        if (key != null) {
                            builder.queryParam("continuation_key", key);
                        }
                        return builder.build(accountUid);
                    })
                    .retrieve()
                    .body(JsonNode.class));
            for (JsonNode node : page.path("transactions")) {
                FetchedTransaction transaction = toTransaction(node);
                if (transaction != null && !transaction.bookingDate().isBefore(since)) {
                    transactions.add(transaction);
                }
            }
            continuationKey = text(page.path("continuation_key"), null);
        } while (continuationKey != null && !continuationKey.isBlank());
        return transactions;
    }

    /** Starts the consent flow: returns the URL of the bank's authorization page. */
    public String startAuthorization(Institution institution, String state) {
        String aspspName = institution.getExternalRef();
        if (aspspName == null || aspspName.isBlank()) {
            throw new EnableBankingException("Institution " + institution.getName()
                    + " has no externalRef — set it to the Enable Banking ASPSP name (e.g. \"Boursorama\")");
        }
        String country = countryOf(institution);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("access", Map.of("valid_until", consentValidUntil(aspspName, country).toString()));
        body.put("aspsp", Map.of("name", aspspName, "country", country));
        body.put("state", state);
        body.put("redirect_url", properties.redirectUrl());
        body.put("psu_type", "personal");
        JsonNode response = call(() -> enableBankingRestClient.post()
                .uri("/auth")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class));
        return response.path("url").asText();
    }

    /** Exchanges the authorization code the bank redirected with for a session. */
    public EnableBankingSession createSession(String code) {
        JsonNode response = call(() -> enableBankingRestClient.post()
                .uri("/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("code", code))
                .retrieve()
                .body(JsonNode.class));
        String validUntil = text(response.path("access").path("valid_until"), null);
        return new EnableBankingSession(
                response.path("session_id").asText(),
                validUntil == null ? null : toLocal(OffsetDateTime.parse(validUntil)));
    }

    public record EnableBankingSession(String sessionId, LocalDateTime validUntil) {
    }

    /** external id (identification_hash, or uid when the ASPSP gives none) → uid, for the stored session. */
    private Map<String, String> resolveAccountUids(Institution institution) {
        if (institution.getExternalSessionId() == null) {
            throw new EnableBankingException("Institution " + institution.getName() + " is not connected to "
                    + "Enable Banking yet — call POST /api/institutions/" + institution.getId() + "/connect");
        }
        if (institution.getSessionValidUntil() != null
                && institution.getSessionValidUntil().isBefore(LocalDateTime.now())) {
            throw new EnableBankingException("Enable Banking consent for " + institution.getName()
                    + " expired on " + institution.getSessionValidUntil()
                    + " — reconnect via POST /api/institutions/" + institution.getId() + "/connect");
        }

        JsonNode session = get("/sessions/{id}", institution.getExternalSessionId());
        Map<String, String> hashByUid = new LinkedHashMap<>();
        for (JsonNode data : session.path("accounts_data")) {
            hashByUid.put(data.path("uid").asText(), text(data.path("identification_hash"), null));
        }
        Map<String, String> uidByExternalId = new LinkedHashMap<>();
        for (JsonNode node : session.path("accounts")) {
            String uid = node.isTextual() ? node.asText() : node.path("uid").asText();
            String hash = hashByUid.get(uid);
            if (hash == null && node.isObject()) {
                hash = text(node.path("identification_hash"), null);
            }
            uidByExternalId.put(hash != null ? hash : uid, uid);
        }
        accountUidByExternalId.putAll(uidByExternalId);
        return uidByExternalId;
    }

    /** Requested validity, capped by the ASPSP's {@code maximum_consent_validity} (seconds) when listed. */
    private OffsetDateTime consentValidUntil(String aspspName, String country) {
        int days = properties.consentValidityDays() == null ? 90 : properties.consentValidityDays();
        Duration validity = Duration.ofDays(days);
        try {
            JsonNode aspsps = call(() -> enableBankingRestClient.get()
                    .uri(builder -> builder.path("/aspsps").queryParam("country", country).build())
                    .retrieve()
                    .body(JsonNode.class));
            for (JsonNode aspsp : aspsps.path("aspsps")) {
                if (aspspName.equalsIgnoreCase(aspsp.path("name").asText())
                        && aspsp.path("maximum_consent_validity").canConvertToLong()) {
                    Duration max = Duration.ofSeconds(aspsp.path("maximum_consent_validity").asLong());
                    if (!max.isZero() && max.compareTo(validity) < 0) {
                        validity = max;
                    }
                }
            }
        } catch (EnableBankingException e) {
            log.warn("Could not read ASPSP list to cap consent validity, requesting {} days: {}", days, e.getMessage());
        }
        // A few minutes of margin so the bank doesn't reject a validity at its exact maximum.
        return OffsetDateTime.now(ZoneOffset.UTC).plus(validity).minusMinutes(5).withNano(0);
    }

    private FetchedTransaction toTransaction(JsonNode node) {
        // Pending entries get a new reference once booked — importing them would create duplicates.
        String status = text(node.path("status"), "BOOK");
        if (!"BOOK".equals(status)) {
            return null;
        }
        String date = text(node.path("booking_date"),
                text(node.path("value_date"), text(node.path("transaction_date"), null)));
        if (date == null) {
            return null;
        }
        BigDecimal amount = new BigDecimal(text(node.path("transaction_amount").path("amount"), "0")).abs();
        if ("DBIT".equals(text(node.path("credit_debit_indicator"), ""))) {
            amount = amount.negate();
        }
        String currency = text(node.path("transaction_amount").path("currency"), "EUR");
        String description = description(node);
        String externalId = text(node.path("entry_reference"), text(node.path("transaction_id"), null));
        if (externalId == null) {
            // Some ASPSPs give no reference: derive a stable one so re-syncs don't duplicate the entry.
            externalId = "h:" + sha256(date + "|" + amount.toPlainString() + "|" + currency + "|" + description);
        }
        return new FetchedTransaction(externalId, LocalDate.parse(date), amount, currency, description);
    }

    private String description(JsonNode node) {
        List<String> parts = new ArrayList<>();
        for (JsonNode line : node.path("remittance_information")) {
            if (!line.asText().isBlank()) {
                parts.add(line.asText().trim());
            }
        }
        if (parts.isEmpty()) {
            boolean debit = "DBIT".equals(text(node.path("credit_debit_indicator"), ""));
            String counterparty = text(node.path(debit ? "creditor" : "debtor").path("name"), null);
            if (counterparty != null) {
                parts.add(counterparty);
            }
        }
        String description = String.join(" ", parts);
        return description.length() > 500 ? description.substring(0, 500) : description;
    }

    private JsonNode pickBalance(JsonNode balances) {
        for (String type : BALANCE_TYPE_PRIORITY) {
            for (JsonNode balance : balances) {
                if (type.equals(balance.path("balance_type").asText())) {
                    return balance;
                }
            }
        }
        return balances.path(0);
    }

    private String accountLabel(Institution institution, JsonNode details) {
        String label = text(details.path("name"), text(details.path("product"), text(details.path("details"), null)));
        if (label == null) {
            String iban = text(details.path("account_id").path("iban"), null);
            label = institution.getName() + (iban != null ? " " + iban.substring(Math.max(0, iban.length() - 4)) : "");
        }
        return label.length() > 150 ? label.substring(0, 150) : label;
    }

    private Account.AccountType mapAccountType(String cashAccountType) {
        return switch (cashAccountType.toUpperCase()) {
            case "SVGS", "LLSV", "ONDP" -> Account.AccountType.SAVINGS;
            case "CARD" -> Account.AccountType.CARD;
            default -> Account.AccountType.CHECKING;
        };
    }

    private JsonNode get(String path, Object... uriVariables) {
        return call(() -> enableBankingRestClient.get()
                .uri(path, uriVariables)
                .retrieve()
                .body(JsonNode.class));
    }

    private JsonNode call(Supplier<JsonNode> request) {
        try {
            JsonNode body = request.get();
            if (body == null) {
                throw new EnableBankingException("empty response from Enable Banking");
            }
            return body;
        } catch (RestClientResponseException e) {
            throw new EnableBankingException("Enable Banking API error " + e.getStatusCode().value()
                    + ": " + e.getResponseBodyAsString(), e);
        }
    }

    static String countryOf(Institution institution) {
        String country = institution.getExternalCountry();
        return country == null || country.isBlank() ? DEFAULT_COUNTRY : country;
    }

    private static LocalDateTime toLocal(OffsetDateTime dateTime) {
        return dateTime.atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }

    private static String text(JsonNode node, String fallback) {
        return node.isMissingNode() || node.isNull() || node.asText().isBlank() ? fallback : node.asText();
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
