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

@Entity
@Table(name = "analysis_session")
@Getter
@Setter
public class AnalysisSession {

    @Id
    private UUID id = UUID.randomUUID();

    private String title;

    @Column(name = "word_filename")
    private String wordFilename;

    @Enumerated(EnumType.STRING)
    @Column(name = "jxml_source_type", nullable = false)
    private JxmlSourceType jxmlSourceType;

    @Column(name = "jxml_filename")
    private String jxmlFilename;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AnalysisStatus status = AnalysisStatus.CREATED;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public enum JxmlSourceType {
        ZIP_UPLOAD,
        PASTED_TEXT
    }

    public enum AnalysisStatus {
        CREATED,
        ANALYZED,
        FAILED
    }
}
