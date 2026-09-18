package com.specmerger.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * One content snapshot of a {@link GeneratedDocument} — revision 1 is the AI-generated content
 * at creation time, and each later manual edit (auto-saved, debounced) appends a new revision
 * rather than overwriting, so the document's full edit history stays recoverable.
 */
@Entity
@Table(name = "document_revision")
@Getter
@Setter
public class DocumentRevision {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "revision_number", nullable = false)
    private int revisionNumber;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
