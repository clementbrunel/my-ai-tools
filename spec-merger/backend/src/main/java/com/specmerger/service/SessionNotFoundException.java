package com.specmerger.service;

/**
 * The session id does not exist (yet): an expected case after the database was reset, or when an id from another
 * environment is pasted. Still an {@link IllegalArgumentException}, as before, but answered with a 404 instead of
 * an unhandled 500 (see ApiExceptionHandler).
 */
public class SessionNotFoundException extends IllegalArgumentException {

    public SessionNotFoundException(String message) {
        super(message);
    }
}
