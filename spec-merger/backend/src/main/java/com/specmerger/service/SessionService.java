package com.specmerger.service;

import com.specmerger.dto.SessionExport;
import com.specmerger.entity.Session;
import com.specmerger.repository.SessionRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tracks a user's working session — see {@link Session} — across the three document slots (Word
 * spec, JXML spec, their merge), created as soon as the first of the three is generated. The
 * frontend keeps only the session's id (in localStorage) to recover the whole thing later, from
 * another machine, whether or not a merge ever happens.
 */
@Service
public class SessionService {

    private final SessionRepository sessionRepository;
    private final GeneratedDocumentService documentService;

    public SessionService(SessionRepository sessionRepository, GeneratedDocumentService documentService) {
        this.sessionRepository = sessionRepository;
        this.documentService = documentService;
    }

    /**
     * Attaches a freshly generated Word document to a session, creating that session first if
     * {@code sessionId} is null — the case for the very first generation of a brand new session.
     * Returns the session's id either way, for the frontend to keep.
     */
    @Transactional
    public UUID attachWordDocument(UUID sessionId, UUID wordDocumentId) {
        Session session = sessionOrNew(sessionId);
        session.setWordDocumentId(wordDocumentId);
        return sessionRepository.save(session).getId();
    }

    /** Same as {@link #attachWordDocument}, for the JXML slot. */
    @Transactional
    public UUID attachJxmlDocument(UUID sessionId, UUID jxmlDocumentId) {
        Session session = sessionOrNew(sessionId);
        session.setJxmlDocumentId(jxmlDocumentId);
        return sessionRepository.save(session).getId();
    }

    /**
     * Attaches a freshly merged document to an existing session — unlike the Word/JXML slots, a
     * merge can only happen once a session (with both of those already attached) exists, so
     * {@code sessionId} is required here.
     */
    @Transactional
    public UUID attachMergedDocument(UUID sessionId, UUID mergedDocumentId, String gitlabSelectionJson) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session introuvable: " + sessionId));
        session.setMergedDocumentId(mergedDocumentId);
        session.setGitlabSelectionJson(gitlabSelectionJson);
        return sessionRepository.save(session).getId();
    }

    /**
     * Everything needed to recover a session from another machine, from just its id: the current
     * content of whichever of its three slots exist so far, and the GitLab selection it carries.
     */
    @Transactional(readOnly = true)
    public SessionExport getSession(UUID sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session introuvable: " + sessionId));
        String wordMarkdown = session.getWordDocumentId() == null ? null
                : documentService.getLatestContent(session.getWordDocumentId());
        String jxmlMarkdown = session.getJxmlDocumentId() == null ? null
                : documentService.getLatestContent(session.getJxmlDocumentId());
        String mergedMarkdown = session.getMergedDocumentId() == null ? null
                : documentService.getLatestContent(session.getMergedDocumentId());
        return new SessionExport(session.getId(), session.getWordDocumentId(), wordMarkdown,
                session.getJxmlDocumentId(), jxmlMarkdown, session.getMergedDocumentId(), mergedMarkdown,
                session.getGitlabSelectionJson());
    }

    private Session sessionOrNew(UUID sessionId) {
        if (sessionId == null) {
            return new Session();
        }
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session introuvable: " + sessionId));
    }
}
