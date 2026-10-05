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
 * One AI generation event — the Word-generated spec, the JXML-generated spec, or their merge.
 * Which session it belongs to, and (for a merge) which Word/JXML documents it was produced from,
 * is tracked by {@link Session}, not here — this entity only ever holds its own content, never
 * mutated directly: it lives in {@link DocumentRevision}, appended to on every edit so a
 * document's full history is kept.
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

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public enum Source {
        WORD,
        JXML,
        MERGED
    }
}
