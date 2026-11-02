package com.mymoneyhub.dto;

/** What to do with one (connexion, compte) pair found in a Linxo export. {@code accountId} is required for LINK. */
public record LinxoAccountChoice(String connection, String account, Action action, Long accountId) {

    public enum Action {
        /** Import into an existing account. */
        LINK,
        /** Create a new active account (counted in net worth). */
        CREATE_ACTIVE,
        /** Create a new archived account: history only, excluded from net worth. */
        CREATE_ARCHIVED
    }
}
