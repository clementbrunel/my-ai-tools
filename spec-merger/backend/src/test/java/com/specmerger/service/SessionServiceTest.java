package com.specmerger.service;

import com.specmerger.dto.SessionExport;
import com.specmerger.entity.Session;
import com.specmerger.repository.SessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    @Mock
    private SessionRepository sessionRepository;
    @Mock
    private GeneratedDocumentService documentService;

    private SessionService newService() {
        return new SessionService(sessionRepository, documentService);
    }

    @Test
    void attachWordDocumentCreatesANewSessionWhenNoneIsGivenYet() {
        SessionService service = newService();
        UUID wordId = UUID.randomUUID();
        when(sessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        UUID sessionId = service.attachWordDocument(null, wordId);

        ArgumentCaptor<Session> captor = ArgumentCaptor.forClass(Session.class);
        verify(sessionRepository).save(captor.capture());
        assertThat(captor.getValue().getWordDocumentId()).isEqualTo(wordId);
        assertThat(captor.getValue().getId()).isEqualTo(sessionId);
    }

    @Test
    void attachWordDocumentUpdatesTheExistingSessionWhenGivenOne() {
        SessionService service = newService();
        UUID existingSessionId = UUID.randomUUID();
        UUID wordId = UUID.randomUUID();
        Session existing = new Session();
        existing.setId(existingSessionId);
        when(sessionRepository.findById(existingSessionId)).thenReturn(Optional.of(existing));
        when(sessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        UUID sessionId = service.attachWordDocument(existingSessionId, wordId);

        assertThat(sessionId).isEqualTo(existingSessionId);
        assertThat(existing.getWordDocumentId()).isEqualTo(wordId);
    }

    @Test
    void attachWordDocumentThrowsWhenGivenAnUnknownSessionId() {
        SessionService service = newService();
        UUID unknownSessionId = UUID.randomUUID();
        when(sessionRepository.findById(unknownSessionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.attachWordDocument(unknownSessionId, UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(unknownSessionId.toString());
    }

    @Test
    void attachJxmlDocumentCreatesANewSessionWhenNoneIsGivenYet() {
        SessionService service = newService();
        UUID jxmlId = UUID.randomUUID();
        when(sessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        UUID sessionId = service.attachJxmlDocument(null, jxmlId);

        ArgumentCaptor<Session> captor = ArgumentCaptor.forClass(Session.class);
        verify(sessionRepository).save(captor.capture());
        assertThat(captor.getValue().getJxmlDocumentId()).isEqualTo(jxmlId);
        assertThat(captor.getValue().getId()).isEqualTo(sessionId);
    }

    @Test
    void attachMergedDocumentSetsTheMergedIdAndGitlabSelectionOnAnExistingSession() {
        SessionService service = newService();
        UUID sessionId = UUID.randomUUID();
        UUID mergedId = UUID.randomUUID();
        Session existing = new Session();
        existing.setId(sessionId);
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(existing));
        when(sessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        UUID result = service.attachMergedDocument(sessionId, mergedId, "{\"projectId\":\"1\"}");

        assertThat(result).isEqualTo(sessionId);
        assertThat(existing.getMergedDocumentId()).isEqualTo(mergedId);
        assertThat(existing.getGitlabSelectionJson()).isEqualTo("{\"projectId\":\"1\"}");
    }

    @Test
    void attachMergedDocumentThrowsForAnUnknownSession() {
        SessionService service = newService();
        UUID unknownSessionId = UUID.randomUUID();
        when(sessionRepository.findById(unknownSessionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.attachMergedDocument(unknownSessionId, UUID.randomUUID(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(unknownSessionId.toString());
    }

    @Test
    void getSessionReturnsOnlyTheSlotsThatExistSoFar() {
        SessionService service = newService();
        UUID sessionId = UUID.randomUUID();
        UUID wordId = UUID.randomUUID();
        Session session = new Session();
        session.setId(sessionId);
        session.setWordDocumentId(wordId);
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(documentService.getLatestContent(wordId)).thenReturn("# Word");

        SessionExport export = service.getSession(sessionId);

        assertThat(export.sessionId()).isEqualTo(sessionId);
        assertThat(export.wordDocumentId()).isEqualTo(wordId);
        assertThat(export.wordMarkdown()).isEqualTo("# Word");
        assertThat(export.jxmlDocumentId()).isNull();
        assertThat(export.jxmlMarkdown()).isNull();
        assertThat(export.mergedDocumentId()).isNull();
        assertThat(export.mergedMarkdown()).isNull();
        assertThat(export.gitlabSelectionJson()).isNull();
    }

    @Test
    void getSessionReturnsAllThreeSlotsAndTheGitlabSelectionOnceAMergeHasHappened() {
        SessionService service = newService();
        UUID sessionId = UUID.randomUUID();
        UUID wordId = UUID.randomUUID();
        UUID jxmlId = UUID.randomUUID();
        UUID mergedId = UUID.randomUUID();
        Session session = new Session();
        session.setId(sessionId);
        session.setWordDocumentId(wordId);
        session.setJxmlDocumentId(jxmlId);
        session.setMergedDocumentId(mergedId);
        session.setGitlabSelectionJson("{\"projectId\":\"1\"}");
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(documentService.getLatestContent(wordId)).thenReturn("# Word");
        when(documentService.getLatestContent(jxmlId)).thenReturn("# JXML");
        when(documentService.getLatestContent(mergedId)).thenReturn("# Fusionné");

        SessionExport export = service.getSession(sessionId);

        assertThat(export.wordMarkdown()).isEqualTo("# Word");
        assertThat(export.jxmlMarkdown()).isEqualTo("# JXML");
        assertThat(export.mergedMarkdown()).isEqualTo("# Fusionné");
        assertThat(export.gitlabSelectionJson()).isEqualTo("{\"projectId\":\"1\"}");
    }

    @Test
    void getSessionThrowsForAnUnknownSession() {
        SessionService service = newService();
        UUID sessionId = UUID.randomUUID();
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSession(sessionId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(sessionId.toString());
    }
}
