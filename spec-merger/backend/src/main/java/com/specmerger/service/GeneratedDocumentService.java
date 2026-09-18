package com.specmerger.service;

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
        return create(Source.WORD, content, null, null);
    }

    @Transactional
    public GeneratedDocument createJxml(String content) {
        return create(Source.JXML, content, null, null);
    }

    @Transactional
    public GeneratedDocument createMerged(String content, UUID wordDocumentId, UUID jxmlDocumentId) {
        return create(Source.MERGED, content, wordDocumentId, jxmlDocumentId);
    }

    /** The document's latest revision content — what the frontend restores after a reload. */
    @Transactional(readOnly = true)
    public String getLatestContent(UUID documentId) {
        return latestRevision(documentId).getContent();
    }

    /** Appends a new revision (never overwrites) — backs the debounced auto-save of manual edits. */
    @Transactional
    public void addRevision(UUID documentId, String content) {
        if (!documentRepository.existsById(documentId)) {
            throw new IllegalArgumentException("Document introuvable: " + documentId);
        }
        saveNextRevision(documentId, content);
    }

    private GeneratedDocument create(Source source, String content, UUID wordDocumentId, UUID jxmlDocumentId) {
        GeneratedDocument document = new GeneratedDocument();
        document.setSource(source);
        document.setWordDocumentId(wordDocumentId);
        document.setJxmlDocumentId(jxmlDocumentId);
        document = documentRepository.save(document);
        saveNextRevision(document.getId(), content);
        return document;
    }

    private void saveNextRevision(UUID documentId, String content) {
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
