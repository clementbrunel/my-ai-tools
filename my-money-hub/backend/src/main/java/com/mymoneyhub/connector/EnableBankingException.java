package com.mymoneyhub.connector;

public class EnableBankingException extends RuntimeException {
    public EnableBankingException(String message) {
        super(message);
    }

    public EnableBankingException(String message, Throwable cause) {
        super(message, cause);
    }
}
