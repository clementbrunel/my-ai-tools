package com.specmerger.service;

import com.specmerger.dto.SessionExport;
import com.specmerger.entity.DocumentRevision;
import com.specmerger.entity.GeneratedDocument;
import com.specmerger.entity.GeneratedDocument.Source;
import com.specmerger.repository.DocumentRevisionRepository;
import com.specmerger.repository.GeneratedDocumentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Persists AI generations (Word spec, JXML spec, their merge) and manual edits to them — see
 * {@link GeneratedDocument}/{@link DocumentRevision}. The frontend keeps only each document's id
 * (in localStorage) to recover a session, fetching content back through this service instead of
 * holding the markdown itself across reloads.
 */
@Service
public class GeneratedDocumentService {

    private final GeneratedDocumentRepository documentRepository;
    private final DocumentRevisionRepository revisionRepository;

    public GeneratedDocumentService(GeneratedDocumentRepository documentRepository,
                                     DocumentRevisionRepository revisionRepository) {
        this.documentRepository = documentRepository;
        this.revisionRepository = revisionRepository;
    }

    @Transactional
    public GeneratedDocument createWord(String content) {
        return create(Source.WORD, content, null, null, null);
    }

    @Transactional
    public GeneratedDocument createJxml(String content) {
        return create(Source.JXML, content, null, null, null);
    }

    @Transactional
    public GeneratedDocument createMerged(String content, UUID wordDocumentId, UUID jxmlDocumentId,
                                           String gitlabSelectionJson) {
        return create(Source.MERGED, content, wordDocumentId, jxmlDocumentId, gitlabSelectionJson);
    }

    /** The document's latest revision content — what the frontend restores after a reload. */
    @Transactional(readOnly = true)
    public String getLatestContent(UUID documentId) {
        return latestRevision(documentId).getContent();
    }

    /**
     * Everything needed to recover a session from another machine, from any one of its documents'
     * id — not just a finished MERGED one: a lone WORD or JXML generation is just as recoverable
     * this way, and if it's been {@link #linkCounterparts linked} to a counterpart, that one comes
     * back too even though no merge ever happened. On a MERGED document this also carries the two
     * documents it was produced from (best-effort — see {@link GeneratedDocument}) and the GitLab
     * selection it carries.
     */
    @Transactional(readOnly = true)
    public SessionExport getSession(UUID documentId) {
        GeneratedDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document introuvable: " + documentId));
        String content = latestRevision(documentId).getContent();
        return switch (document.getSource()) {
            case MERGED -> {
                String wordMarkdown = document.getWordDocumentId() == null ? null
                        : latestRevision(document.getWordDocumentId()).getContent();
                String jxmlMarkdown = document.getJxmlDocumentId() == null ? null
                        : latestRevision(document.getJxmlDocumentId()).getContent();
                yield new SessionExport(document.getId(), content, document.getWordDocumentId(), wordMarkdown,
                        document.getJxmlDocumentId(), jxmlMarkdown, document.getGitlabSelectionJson());
            }
            case WORD -> {
                String jxmlMarkdown = document.getJxmlDocumentId() == null ? null
                        : latestRevision(document.getJxmlDocumentId()).getContent();
                yield new SessionExport(null, null, document.getId(), content, document.getJxmlDocumentId(),
                        jxmlMarkdown, null);
            }
            case JXML -> {
                String wordMarkdown = document.getWordDocumentId() == null ? null
                        : latestRevision(document.getWordDocumentId()).getContent();
                yield new SessionExport(null, null, document.getWordDocumentId(), wordMarkdown, document.getId(),
                        content, null);
            }
        };
    }

    /**
     * Pairs a WORD and a JXML document as belonging to the same in-progress session, before either
     * has been merged — so {@link #getSession} can recover both from just one of their ids without
     * an actual AI merge. Called again (overwriting the previous pairing) whenever one side is
     * regenerated while the other still exists — best-effort, same spirit as a MERGED document's
     * recorded source ids.
     */
    @Transactional
    public void linkCounterparts(UUID wordDocumentId, UUID jxmlDocumentId) {
        GeneratedDocument word = documentRepository.findById(wordDocumentId)
                .orElseThrow(() -> new IllegalArgumentException("Document introuvable: " + wordDocumentId));
        GeneratedDocument jxml = documentRepository.findById(jxmlDocumentId)
                .orElseThrow(() -> new IllegalArgumentException("Document introuvable: " + jxmlDocumentId));
        if (word.getSource() != Source.WORD) {
            throw new IllegalArgumentException("Ce document n'est pas une doc Word: " + wordDocumentId);
        }
        if (jxml.getSource() != Source.JXML) {
            throw new IllegalArgumentException("Ce document n'est pas une doc JXML: " + jxmlDocumentId);
        }
        word.setJxmlDocumentId(jxmlDocumentId);
        jxml.setWordDocumentId(wordDocumentId);
        documentRepository.save(word);
        documentRepository.save(jxml);
    }

    /** Appends a new revision (never overwrites) — backs the debounced auto-save of manual edits. */
    @Transactional
    public void addRevision(UUID documentId, String content) {
        saveNextRevision(documentId, content);
    }

    private GeneratedDocument create(Source source, String content, UUID wordDocumentId, UUID jxmlDocumentId,
                                      String gitlabSelectionJson) {
        GeneratedDocument document = new GeneratedDocument();
        document.setSource(source);
        document.setWordDocumentId(wordDocumentId);
        document.setJxmlDocumentId(jxmlDocumentId);
        document.setGitlabSelectionJson(gitlabSelectionJson);
        document = documentRepository.save(document);
        saveNextRevision(document.getId(), content);
        return document;
    }

    private void saveNextRevision(UUID documentId, String content) {
        documentRepository.lockById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document introuvable: " + documentId));
        int nextRevisionNumber = revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(documentId)
                .map(r -> r.getRevisionNumber() + 1)
                .orElse(1);
        DocumentRevision revision = new DocumentRevision();
        revision.setDocumentId(documentId);
        revision.setRevisionNumber(nextRevisionNumber);
        revision.setContent(content);
        revisionRepository.save(revision);
    }

    private DocumentRevision latestRevision(UUID documentId) {
        return revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document introuvable: " + documentId));
    }
}
