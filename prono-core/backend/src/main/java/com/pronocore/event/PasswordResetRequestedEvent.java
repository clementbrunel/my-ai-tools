package com.pronocore.event;

/**
 * Published after a password-reset token is created.
 * The email-sending feature branch should add an @EventListener for this event
 * to send the reset link to the user.
 */
public record PasswordResetRequestedEvent(String email, String token, String username) {}
