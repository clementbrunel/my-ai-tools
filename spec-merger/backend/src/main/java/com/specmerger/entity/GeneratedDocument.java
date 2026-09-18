package com.specmerger.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * One AI generation event — the Word-generated spec, the JXML-generated spec, or their merge —
 * identified by a stable id the frontend keeps (in localStorage) to recover a session without
 * holding the markdown itself client-side. Its content is never mutated directly; it lives in
 * {@link DocumentRevision}, appended to on every edit so a document's full history is kept. The
 * counterpart-linking fields below are the one exception: on a WORD/JXML document they're updated
 * after creation as its session's other half gets generated (or regenerated).
 */
@Entity
@Table(name = "generated_document")
@Getter
@Setter
public class GeneratedDocument {

    @Id
    private UUID id = UUID.randomUUID();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Source source;

    // On a MERGED document: the two generations it was produced from, kept for history/debugging
    // — best-effort, since the markdown actually sent to the merge call may have since diverged
    // from these documents' latest revision if the user edited it first. On a WORD or JXML
    // document: its counterpart in the same in-progress session, if one has been generated and
    // linked (see GeneratedDocumentService#linkCounterparts) — lets a session be recovered from
    // either document's id alone before a merge ever happens. Mutable on WORD/JXML documents
    // (re-linked whenever a new counterpart is generated); set once at creation on MERGED ones.
    @Column(name = "word_document_id")
    private UUID wordDocumentId;

    @Column(name = "jxml_document_id")
    private UUID jxmlDocumentId;

    // Set only on a MERGED document — the GitLab project selection (repo, entry point, selected
    // files) it was generated from, opaque JSON as far as the backend is concerned. Lets the
    // frontend export/import a whole session (the 3 documents + the GitLab project) to/from
    // another machine using just this document's id.
    @Column(name = "gitlab_selection_json", columnDefinition = "TEXT")
    private String gitlabSelectionJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public enum Source {
        WORD,
        JXML,
        MERGED
    }
}
