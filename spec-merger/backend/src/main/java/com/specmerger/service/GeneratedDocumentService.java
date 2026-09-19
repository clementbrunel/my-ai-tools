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
 * {@link GeneratedDocument}/{@link DocumentRevision}. Which session a document belongs to is
 * tracked separately by {@link com.specmerger.service.SessionService}.
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
        return create(Source.WORD, content);
    }

    @Transactional
    public GeneratedDocument createJxml(String content) {
        return create(Source.JXML, content);
    }

    @Transactional
    public GeneratedDocument createMerged(String content) {
        return create(Source.MERGED, content);
    }

    /** The document's latest revision content — what the frontend restores after a reload. */
    @Transactional(readOnly = true)
    public String getLatestContent(UUID documentId) {
        return latestRevision(documentId).getContent();
    }

    /** Appends a new revision (never overwrites) — backs the debounced auto-save of manual edits. */
    @Transactional
    public void addRevision(UUID documentId, String content) {
        saveNextRevision(documentId, content);
    }

    private GeneratedDocument create(Source source, String content) {
        GeneratedDocument document = new GeneratedDocument();
        document.setSource(source);
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
