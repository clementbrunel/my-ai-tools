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

@Entity
@Table(name = "divergence")
@Getter
@Setter
public class Divergence {

    @Id
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private AnalysisSession session;

    @Column(name = "section_ref")
    private String sectionRef;

    @Column(name = "word_excerpt", columnDefinition = "TEXT")
    private String wordExcerpt;

    @Column(name = "jxml_excerpt", columnDefinition = "TEXT")
    private String jxmlExcerpt;

    @Column(name = "ai_proposal", columnDefinition = "TEXT")
    private String aiProposal;

    @Enumerated(EnumType.STRING)
    @Column(name = "resolution_status", nullable = false)
    private ResolutionStatus resolutionStatus = ResolutionStatus.PENDING;

    @Column(name = "resolved_value", columnDefinition = "TEXT")
    private String resolvedValue;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public enum ResolutionStatus {
        PENDING,
        ACCEPTED,
        EDITED,
        REJECTED
    }
}
