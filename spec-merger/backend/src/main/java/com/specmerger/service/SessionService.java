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
     * Attaches a freshly generated Word document to a session. {@code sessionId} is null for the
     * very first generation of a brand new session — the frontend now pre-allocates that id
     * client-side (rather than leaving the backend to mint one) precisely so that a Word
     * generation and a JXML generation fired at the same time, before either has returned, both
     * carry the same id and land on the same session instead of racing into two separate ones; a
     * null id here only still happens for a caller that doesn't pre-allocate. Either way, if the
     * given id doesn't exist yet, it's created with exactly that id — never a different one — so
     * the caller's id is always the one that ends up owning the session. Returns the session's id
     * either way, for the frontend to keep.
     */
    @Transactional
    public UUID attachWordDocument(UUID sessionId, UUID wordDocumentId) {
        Session session = findOrCreate(sessionId);
        session.setWordDocumentId(wordDocumentId);
        return sessionRepository.save(session).getId();
    }

    /** Same as {@link #attachWordDocument}, for the JXML slot — {@code gitlabSelectionJson}, if
     * the frontend has a GitLab project selected, is recorded on the session right away (rather
     * than only once a merge happens) so it survives a reload even before there's anything to
     * merge with; null leaves the session's existing value (if any) untouched. */
    @Transactional
    public UUID attachJxmlDocument(UUID sessionId, UUID jxmlDocumentId, String gitlabSelectionJson) {
        Session session = findOrCreate(sessionId);
        session.setJxmlDocumentId(jxmlDocumentId);
        if (gitlabSelectionJson != null) {
            session.setGitlabSelectionJson(gitlabSelectionJson);
        }
        return sessionRepository.save(session).getId();
    }

    /**
     * Attaches a freshly merged document to an existing session — unlike the Word/JXML slots, a
     * merge can only happen once a session (with both of those already attached) exists, so
     * {@code sessionId} is required here.
     */
    @Transactional
    public UUID attachMergedDocument(UUID sessionId, UUID mergedDocumentId, String gitlabSelectionJson) {
        Session session = requireExisting(sessionId);
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
        Session session = requireExisting(sessionId);
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

    /** A null or unknown id is always a caller mistake here — an existing session is required. */
    private Session requireExisting(UUID sessionId) {
        if (sessionId == null) {
            throw new IllegalArgumentException("Session introuvable: null");
        }
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session introuvable: " + sessionId));
    }

    /**
     * A null id creates a brand new session (with a fresh random id). A non-null id that doesn't
     * exist yet is created WITH that exact id, rather than rejected — see {@link
     * #attachWordDocument}'s note on why the frontend pre-allocates one.
     */
    private Session findOrCreate(UUID sessionId) {
        if (sessionId == null) {
            return new Session();
        }
        return sessionRepository.findById(sessionId).orElseGet(() -> {
            Session session = new Session();
            session.setId(sessionId);
            return session;
        });
    }
}
