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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Covers BNP Paribas via woob's {@code bnp} module (github.com/rbignon/woob/tree/master/modules/bnp
 * — the module formerly named {@code bnporc}, renamed/split in 2023, last substantive fix Aug 2024).
 * <p>
 * Shells out to the {@code woob} CLI rather than embedding a Python runtime — assumes woob is
 * installed and its backend already configured (credentials stored via {@code woob config add bnp},
 * not by this app). {@link Institution#getExternalRef()} must hold the woob backend name.
 * <p>
 * VERIFY BEFORE FIRST RUN: the exact subcommand/flags below (`woob bank -f json list`) against
 * {@code woob bank --help} on the installed version — CLI surface isn't pinned by this project.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WoobConnector implements BankConnector {

    private final WoobProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Institution.ConnectorType supports() {
        return Institution.ConnectorType.WOOB;
    }

    @Override
    public List<FetchedAccount> fetchAccounts(Institution institution) {
        JsonNode root = runJson("bank", "-f", "json", "list", institution.getExternalRef());
        List<FetchedAccount> accounts = new ArrayList<>();
        for (JsonNode node : root) {
            accounts.add(new FetchedAccount(
                    node.path("id").asText(null),
                    node.path("label").asText(""),
                    node.path("iban").asText(null),
                    node.path("currency").asText("EUR"),
                    mapAccountType(node.path("type").asText("")),
                    new BigDecimal(node.path("balance").asText("0"))
            ));
        }
        return accounts;
    }

    @Override
    public List<FetchedTransaction> fetchTransactions(Institution institution, Account account, LocalDate since) {
        JsonNode root = runJson("bank", "-f", "json", "history", account.getExternalAccountId());
        List<FetchedTransaction> transactions = new ArrayList<>();
        for (JsonNode node : root) {
            LocalDate bookingDate = LocalDate.parse(node.path("date").asText());
            if (bookingDate.isBefore(since)) {
                continue;
            }
            transactions.add(new FetchedTransaction(
                    node.path("id").asText(null),
                    bookingDate,
                    new BigDecimal(node.path("amount").asText("0")),
                    node.path("currency").asText("EUR"),
                    node.path("raw").asText(node.path("label").asText(""))
            ));
        }
        return transactions;
    }

    private JsonNode runJson(String... args) {
        List<String> command = new ArrayList<>();
        command.add(properties.binaryPath());
        command.addAll(List.of(args));
        try {
            Process process = new ProcessBuilder(command)
                    .redirectErrorStream(false)
                    .start();
            byte[] output = process.getInputStream().readAllBytes();
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                byte[] error = process.getErrorStream().readAllBytes();
                throw new WoobExecutionException(
                        "woob exited with code " + exitCode + ": " + new String(error));
            }
            return objectMapper.readTree(output);
        } catch (IOException e) {
            throw new WoobExecutionException("failed to run woob command: " + command, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new WoobExecutionException("interrupted while running woob command: " + command, e);
        }
    }

    private Account.AccountType mapAccountType(String woobType) {
        return switch (woobType.toLowerCase()) {
            case "savings" -> Account.AccountType.SAVINGS;
            case "card" -> Account.AccountType.CARD;
            case "market", "pea", "lifeinsurance" -> Account.AccountType.INVESTMENT;
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
