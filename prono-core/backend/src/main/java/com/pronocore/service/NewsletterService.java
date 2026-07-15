package com.pronocore.service;

import com.pronocore.dto.request.NewsletterRequest;
import com.pronocore.dto.response.NewsletterResponse;
import com.pronocore.entity.Newsletter;
import com.pronocore.entity.User;
import com.pronocore.repository.NewsletterRepository;
import com.pronocore.service.email.EmailSender;
import com.pronocore.service.email.EmailTheme;
import com.pronocore.service.email.MarkdownEmailRenderer;
import com.pronocore.service.email.template.NewsletterEmailTemplate;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class NewsletterService {

    private final NewsletterRepository newsletterRepository;
    private final MarkdownEmailRenderer markdownRenderer;
    private final NewsletterDispatcher dispatcher;
    private final EmailSender emailSender;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Transactional(readOnly = true)
    public List<NewsletterResponse> listAll() {
        return newsletterRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(NewsletterResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public NewsletterResponse get(Long id) {
        return NewsletterResponse.from(load(id));
    }

    @Transactional
    public NewsletterResponse create(NewsletterRequest req, String createdBy) {
        Newsletter n = Newsletter.builder()
                .title(req.getTitle())
                .subtitle(req.getSubtitle())
                .bodyMd(req.getBodyMd())
                .theme(req.getTheme() != null ? req.getTheme() : Newsletter.Theme.FOOTBALL)
                .ctaLabel(req.getCtaLabel())
                .ctaUrl(req.getCtaUrl())
                .status(Newsletter.Status.DRAFT)
                .createdBy(createdBy)
                .build();
        return NewsletterResponse.from(newsletterRepository.save(n));
    }

    @Transactional
    public NewsletterResponse update(Long id, NewsletterRequest req) {
        Newsletter n = load(id);
        requireDraft(n);
        n.setTitle(req.getTitle());
        n.setSubtitle(req.getSubtitle());
        n.setBodyMd(req.getBodyMd());
        n.setTheme(req.getTheme() != null ? req.getTheme() : Newsletter.Theme.FOOTBALL);
        n.setCtaLabel(req.getCtaLabel());
        n.setCtaUrl(req.getCtaUrl());
        return NewsletterResponse.from(newsletterRepository.save(n));
    }

    @Transactional
    public void delete(Long id) {
        Newsletter n = load(id);
        requireDraft(n);
        newsletterRepository.delete(n);
    }

    /** Full email HTML for the in-admin preview (does not send anything). */
    @Transactional(readOnly = true)
    public String renderHtml(Long id) {
        return render(load(id));
    }

    /** Sends the campaign to a single address. Never touches status or stats. */
    @Transactional(readOnly = true)
    public void sendTest(Long id, String targetEmail) {
        Newsletter n = load(id);
        emailSender.send(targetEmail, n.getTitle(), render(n));
        log.info("Newsletter {} test sent to {}", id, targetEmail);
    }

    /**
     * Broadcasts the campaign once. Flips the status to SENT synchronously via an
     * atomic {@code UPDATE ... WHERE status = DRAFT}, so two concurrent calls
     * can't both win the race and double-blast every recipient — the loser sees
     * 0 rows updated and fails instead. The winner hands the actual delivery to
     * the async dispatcher. Returns the recipient count.
     */
    @Transactional
    public int broadcast(Long id) {
        Newsletter n = load(id);
        requireDraft(n);

        List<User> recipients = newsletterRepository.findNewsletterRecipients();
        List<String> emails = recipients.stream().map(User::getEmail).toList();
        String html = render(n);

        int updated = newsletterRepository.markAsSent(id, LocalDateTime.now(), emails.size());
        if (updated == 0) {
            throw new IllegalStateException("Cette newsletter a déjà été envoyée et ne peut plus être modifiée.");
        }

        dispatcher.dispatch(id, emails, n.getTitle(), html);
        log.info("Newsletter {} queued for {} recipient(s)", id, emails.size());
        return emails.size();
    }

    private String render(Newsletter n) {
        EmailTheme theme = n.getTheme() == Newsletter.Theme.F1 ? EmailTheme.F1 : EmailTheme.FOOTBALL;
        String bodyHtml = markdownRenderer.toInlineStyledHtml(n.getBodyMd());
        String profileUrl = frontendUrl + "/profile";
        return NewsletterEmailTemplate.build(theme, n.getSubtitle(), bodyHtml,
                n.getCtaLabel(), n.getCtaUrl(), profileUrl);
    }

    private Newsletter load(Long id) {
        return newsletterRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Newsletter introuvable: " + id));
    }

    private void requireDraft(Newsletter n) {
        if (n.getStatus() != Newsletter.Status.DRAFT) {
            throw new IllegalStateException("Cette newsletter a déjà été envoyée et ne peut plus être modifiée.");
        }
    }
}
