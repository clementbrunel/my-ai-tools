package com.specmerger.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * One snapshot of the merged markdown for a session. Never overwritten — a restore
 * creates a new version copying an older one's content, so the full history stays
 * intact and any prior state can always be recovered.
 */
@Entity
@Table(name = "document_version")
@Getter
@Setter
public class DocumentVersion {

    @Id
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private AnalysisSession session;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VersionSource source;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public enum VersionSource {
        GENERATED,
        MANUAL_EDIT,
        RESTORED
    }
}
