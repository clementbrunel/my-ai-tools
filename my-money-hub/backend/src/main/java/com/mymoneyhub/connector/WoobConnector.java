package com.mymoneyhub.connector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mymoneyhub.config.WoobProperties;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.Institution;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Covers BNP Paribas via woob's {@code bnp} module (github.com/rbignon/woob/tree/master/modules/bnp
 * — the module formerly named {@code bnporc}, renamed/split in 2023).
 * <p>
 * Shells out to the {@code woob} CLI rather than embedding a Python runtime — assumes woob is
 * installed and its backend already configured (credentials stored via {@code woob config add bnp},
 * not by this app). {@link Institution#getExternalRef()} must hold the woob backend name.
 * <p>
 * CLI surface checked against woob 3.7 ({@code woob/applications/bank/bank.py} + the JSON formatter):
 * <ul>
 *   <li>{@code woob bank -b <backend> -f json -n 0 list} — {@code list} takes no backend argument
 *       (a positional arg is read as a collection path), so the backend is selected with {@code -b}.</li>
 *   <li>{@code woob bank -b <backend> -f json -n 0 history <id@backend> <YYYY-MM-DD>} — {@code history}
 *       defaults to 10 results; {@code -n 0} lifts the cap and the END_DATE arg stops the scrape at
 *       {@code since} (history is newest-first).</li>
 *   <li>Output is one JSON array of {@code BaseObject.to_dict()}: {@code id} is the full id
 *       ({@code "<id>@<backend>"}), decimals are strings, dates ISO-8601, {@code type} is the int
 *       value of woob's {@code AccountType}/{@code TransactionType} enum, unset fields are {@code null}.
 *       Transactions carry no {@code currency} (amounts are in the account's currency).</li>
 *   <li>Backend errors (bad credentials, site down, 2FA needed…) are printed as {@code Error(<backend>): …}
 *       or {@code Bug(<backend>): …} on stderr while {@code list} still exits 0 with {@code []} — so stderr
 *       is checked, not just the exit code ({@code history} does exit 1).</li>
 *   <li>The {@code bnp} module fills {@code Transaction.id} from BNP's {@code idOperation} for past
 *       operations; life-insurance and coming operations may have none, hence {@link #syntheticId}.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WoobConnector implements BankConnector {

    /** Prefix for ids built by {@link #syntheticId} when the woob module leaves {@code Transaction.id} empty. */
    static final String SYNTHETIC_ID_PREFIX = "woob-sha256:";

    private final WoobProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Institution.ConnectorType supports() {
        return Institution.ConnectorType.WOOB;
    }

    @Override
    public List<FetchedAccount> fetchAccounts(Institution institution) {
        String backend = institution.getExternalRef();
        return parseAccounts(runJson(backend, "list"));
    }

    @Override
    public List<FetchedTransaction> fetchTransactions(Institution institution, Account account, LocalDate since) {
        String backend = institution.getExternalRef();
        JsonNode root = runJson(backend, "history", account.getExternalAccountId(), since.toString());
        return parseTransactions(root, account.getExternalAccountId(), account.getCurrency(), since);
    }

    List<FetchedAccount> parseAccounts(JsonNode root) {
        List<FetchedAccount> accounts = new ArrayList<>();
        for (JsonNode node : root) {
            accounts.add(new FetchedAccount(
                    text(node, "id"),
                    textOr(node, "label", ""),
                    text(node, "iban"),
                    textOr(node, "currency", "EUR"),
                    mapAccountType(node.path("type")),
                    decimal(node, "balance")
            ));
        }
        return accounts;
    }

    List<FetchedTransaction> parseTransactions(JsonNode root, String accountId, String currency, LocalDate since) {
        List<FetchedTransaction> transactions = new ArrayList<>();
        Map<String, Integer> occurrences = new HashMap<>();
        for (JsonNode node : root) {
            // `date` is the debit date; `rdate` (operation date) is a fallback some modules fill alone.
            String date = text(node, "date") != null ? text(node, "date") : text(node, "rdate");
            if (date == null) {
                log.warn("woob transaction without date on account {} skipped: {}", accountId, node);
                continue;
            }
            LocalDate bookingDate = LocalDate.parse(date.substring(0, 10));
            if (bookingDate.isBefore(since)) {
                continue;
            }
            BigDecimal amount = decimal(node, "amount");
            String raw = textOr(node, "raw", "");
            String description = raw.isBlank() ? textOr(node, "label", "") : raw;

            String externalId = transactionId(node);
            if (externalId == null) {
                String key = bookingDate + "|" + amount.toPlainString() + "|" + description;
                int occurrence = occurrences.merge(key, 1, Integer::sum);
                externalId = syntheticId(accountId, key, occurrence);
            }
            transactions.add(new FetchedTransaction(externalId, bookingDate, amount, currency, description));
        }
        return transactions;
    }

    /** The module's own id, or {@code null} when it left it empty — woob then still prints {@code "@<backend>"}. */
    private static String transactionId(JsonNode node) {
        String id = text(node, "id");
        if (id == null || id.isBlank() || id.startsWith("@")) {
            return null;
        }
        return id;
    }

    /**
     * Stable id for transactions the module doesn't identify (common on BNP), so re-syncs dedupe instead
     * of inserting the same rows again. Identical (date, amount, label) rows on one account are told apart
     * by their rank in woob's (stable, newest-first) output.
     */
    static String syntheticId(String accountId, String key, int occurrence) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((accountId + "|" + key + "|" + occurrence).getBytes(StandardCharsets.UTF_8));
            return SYNTHETIC_ID_PREFIX + HexFormat.of().formatHex(hash, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private JsonNode runJson(String backend, String... args) {
        if (backend == null || backend.isBlank()) {
            throw new WoobExecutionException("institution has no woob backend name (externalRef)");
        }
        List<String> command = new ArrayList<>(List.of(
                properties.binaryPath(), "bank", "-b", backend, "-f", "json", "-n", "0"));
        command.addAll(List.of(args));
        try {
            Process process = new ProcessBuilder(command)
                    // No stdin: a 2FA/captcha prompt must fail fast instead of waiting for input.
                    .redirectInput(ProcessBuilder.Redirect.from(new java.io.File(nullDevice())))
                    .start();
            // Drain both pipes concurrently so a chatty stderr can't block the process.
            CompletableFuture<String> stdout = drain(process.getInputStream());
            CompletableFuture<String> stderr = drain(process.getErrorStream());

            if (!process.waitFor(properties.timeout().toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new WoobExecutionException("woob timed out after " + properties.timeout() + ": " + command);
            }
            String out = stdout.join();
            String err = stderr.join();
            int exitCode = process.exitValue();

            List<String> errors = err.lines()
                    .filter(line -> line.startsWith("Error") || line.startsWith("Bug("))
                    .toList();
            if (exitCode != 0 || !errors.isEmpty()) {
                throw new WoobExecutionException("woob " + String.join(" ", args) + " failed (exit " + exitCode + "): "
                        + (errors.isEmpty() ? err.strip() : String.join("; ", errors))
                        + (out.isBlank() ? "" : " | stdout: " + abbreviate(out)));
            }
            if (!err.isBlank()) {
                log.debug("woob stderr: {}", err.strip());
            }
            try {
                JsonNode root = objectMapper.readTree(out);
                if (root == null || !root.isArray()) {
                    throw new WoobExecutionException("unexpected woob output (expected a JSON array): " + abbreviate(out));
                }
                return root;
            } catch (IOException e) {
                // e.g. an unknown `-b` backend makes woob print its interactive "There is currently no
                // configured backend for bank" menu on stdout, and still exit 0.
                throw new WoobExecutionException("unparseable woob output: " + abbreviate(out), e);
            }
        } catch (IOException e) {
            throw new WoobExecutionException("failed to run woob command: " + command, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new WoobExecutionException("interrupted while running woob command: " + command, e);
        }
    }

    private static CompletableFuture<String> drain(InputStream stream) {
        return CompletableFuture.supplyAsync(() -> {
            try (stream) {
                return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }

    private static String abbreviate(String text) {
        String stripped = text.strip();
        return stripped.length() <= 500 ? stripped : stripped.substring(0, 500) + "…";
    }

    private static String nullDevice() {
        return System.getProperty("os.name", "").startsWith("Windows") ? "NUL" : "/dev/null";
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String textOr(JsonNode node, String field, String fallback) {
        String value = text(node, field);
        return value == null ? fallback : value;
    }

    private static BigDecimal decimal(JsonNode node, String field) {
        String value = text(node, field);
        return value == null || value.isBlank() ? BigDecimal.ZERO : new BigDecimal(value);
    }

    /** woob's {@code AccountType} int values (woob/capabilities/bank/base.py); name strings accepted too. */
    static Account.AccountType mapAccountType(JsonNode type) {
        String key = type.isNumber() ? type.asText() : type.asText("").toUpperCase();
        return switch (key) {
            case "2", "SAVINGS", "3", "DEPOSIT", "23", "LDDS", "24", "PEL", "25", "CSL", "26", "CEL",
                 "27", "CAT", "28", "LIVRET_A", "29", "LIVRET_B" -> Account.AccountType.SAVINGS;
            case "7", "CARD" -> Account.AccountType.CARD;
            case "8", "LIFE_INSURANCE", "14", "CAPITALISATION" -> Account.AccountType.LIFE_INSURANCE;
            case "5", "MARKET", "9", "PEE", "10", "PERCO", "11", "ARTICLE_83", "12", "RSP", "13", "PEA",
                 "15", "PERP", "16", "MADELIN", "20", "PER", "21", "REAL_ESTATE", "22", "CROWDLENDING" ->
                    Account.AccountType.INVESTMENT;
            // CHECKING(1), JOINT(6), UNKNOWN(0) and loans (no loan type in our model yet).
            default -> Account.AccountType.CHECKING;
        };
    }

    public static class WoobExecutionException extends RuntimeException {
        public WoobExecutionException(String message) {
            super(message);
        }

        public WoobExecutionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
