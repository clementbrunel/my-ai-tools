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
 * holding the markdown itself client-side. Never mutated after creation; its content lives in
 * {@link DocumentRevision}, appended to on every edit so a document's full history is kept.
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

    // Set only on a MERGED document — the two generations it was produced from, kept for
    // history/debugging. Best-effort: the markdown actually sent to the merge call may have
    // since diverged from these documents' latest revision if the user edited it first.
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
