package com.pronocore.service;

import com.pronocore.dto.request.NewsletterRequest;
import com.pronocore.dto.response.NewsletterResponse;
import com.pronocore.entity.Newsletter;
import com.pronocore.entity.User;
import com.pronocore.repository.NewsletterRepository;
import com.pronocore.service.email.EmailSender;
import com.pronocore.service.email.MarkdownEmailRenderer;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NewsletterServiceTest {

    @Mock private NewsletterRepository newsletterRepository;
    @Mock private MarkdownEmailRenderer markdownRenderer;
    @Mock private NewsletterDispatcher dispatcher;
    @Mock private EmailSender emailSender;

    @InjectMocks
    private NewsletterService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "frontendUrl", "https://app.test");
        lenient().when(markdownRenderer.toInlineStyledHtml(anyString())).thenReturn("<p>corps</p>");
    }

    private Newsletter draft() {
        return Newsletter.builder()
                .id(1L).title("Grosse feature").subtitle("News").bodyMd("## Salut")
                .theme(Newsletter.Theme.FOOTBALL).status(Newsletter.Status.DRAFT).build();
    }

    // ---- broadcast ---------------------------------------------------------

    @Test
    void broadcast_draft_marksSentAndDispatches() {
        Newsletter n = draft();
        when(newsletterRepository.findById(1L)).thenReturn(Optional.of(n));
        when(newsletterRepository.findNewsletterRecipients()).thenReturn(List.of(
                User.builder().id(1L).email("a@test.com").build(),
                User.builder().id(2L).email("b@test.com").build()));

        int count = service.broadcast(1L);

        assertThat(count).isEqualTo(2);
        assertThat(n.getStatus()).isEqualTo(Newsletter.Status.SENT);
        assertThat(n.getSentCount()).isEqualTo(2);
        assertThat(n.getSentAt()).isNotNull();
        verify(newsletterRepository).save(n);
        verify(dispatcher).dispatch(eq(1L), eq(List.of("a@test.com", "b@test.com")), eq("Grosse feature"), anyString());
    }

    @Test
    void broadcast_alreadySent_throwsAndDoesNotDispatch() {
        Newsletter sent = draft();
        sent.setStatus(Newsletter.Status.SENT);
        when(newsletterRepository.findById(1L)).thenReturn(Optional.of(sent));

        assertThatThrownBy(() -> service.broadcast(1L))
                .isInstanceOf(IllegalStateException.class);

        verify(newsletterRepository, never()).findNewsletterRecipients();
        verifyNoInteractions(dispatcher);
    }

    @Test
    void broadcast_unknownId_throwsNotFound() {
        when(newsletterRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.broadcast(99L)).isInstanceOf(EntityNotFoundException.class);
    }

    // ---- sendTest ----------------------------------------------------------

    @Test
    void sendTest_sendsOneEmailAndLeavesStatusUntouched() {
        Newsletter n = draft();
        when(newsletterRepository.findById(1L)).thenReturn(Optional.of(n));

        service.sendTest(1L, "me@test.com");

        verify(emailSender).send(eq("me@test.com"), eq("Grosse feature"), anyString());
        assertThat(n.getStatus()).isEqualTo(Newsletter.Status.DRAFT);
        verify(newsletterRepository, never()).save(any());
        verifyNoInteractions(dispatcher);
    }

    // ---- update / delete guard --------------------------------------------

    @Test
    void update_onSentNewsletter_throwsConflict() {
        Newsletter sent = draft();
        sent.setStatus(Newsletter.Status.SENT);
        when(newsletterRepository.findById(1L)).thenReturn(Optional.of(sent));

        NewsletterRequest req = new NewsletterRequest();
        req.setTitle("x");
        req.setBodyMd("y");

        assertThatThrownBy(() -> service.update(1L, req)).isInstanceOf(IllegalStateException.class);
        verify(newsletterRepository, never()).save(any());
    }

    @Test
    void delete_onSentNewsletter_throwsConflict() {
        Newsletter sent = draft();
        sent.setStatus(Newsletter.Status.SENT);
        when(newsletterRepository.findById(1L)).thenReturn(Optional.of(sent));

        assertThatThrownBy(() -> service.delete(1L)).isInstanceOf(IllegalStateException.class);
        verify(newsletterRepository, never()).delete(any());
    }

    @Test
    void create_persistsDraft() {
        NewsletterRequest req = new NewsletterRequest();
        req.setTitle("Titre");
        req.setBodyMd("## corps");
        req.setTheme(Newsletter.Theme.F1);
        when(newsletterRepository.save(any(Newsletter.class))).thenAnswer(i -> i.getArgument(0));

        NewsletterResponse res = service.create(req, "admin");

        assertThat(res.getStatus()).isEqualTo(Newsletter.Status.DRAFT);
        assertThat(res.getCreatedBy()).isEqualTo("admin");
        assertThat(res.getTheme()).isEqualTo(Newsletter.Theme.F1);
    }
}
