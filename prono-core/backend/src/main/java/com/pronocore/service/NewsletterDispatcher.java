package com.pronocore.service;

import com.pronocore.service.email.EmailSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Delivers a rendered newsletter to a list of recipients off the request thread.
 * Kept in its own bean so the {@link Async} proxy applies (a self-call from
 * NewsletterService would bypass it). Failures are swallowed per-recipient so one
 * bad address never aborts the whole broadcast — same fire-and-forget policy as
 * {@link ReminderSchedulerService}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NewsletterDispatcher {

    private final EmailSender emailSender;

    @Async
    public void dispatch(Long newsletterId, List<String> recipients, String subject, String html) {
        int ok = 0;
        for (String to : recipients) {
            try {
                emailSender.send(to, subject, html);
                ok++;
            } catch (Exception e) {
                log.error("Newsletter {} — failed to send to {}: {}", newsletterId, to, e.getMessage());
            }
            // Gentle pacing to stay within Resend's rate limit on large lists.
            try {
                Thread.sleep(120);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        log.info("Newsletter {} broadcast complete: {}/{} delivered", newsletterId, ok, recipients.size());
    }
}
