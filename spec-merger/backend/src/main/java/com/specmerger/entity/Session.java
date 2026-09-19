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
 * One user's working session across the three document slots (Word spec, JXML spec, their
 * merge) — created with its own stable id as soon as the first of the three is generated, so the
 * frontend has a single id to keep (in localStorage) to recover the whole session later, from
 * another machine, whether or not a merge ever happens. Each slot is filled in independently as
 * its generation completes — nothing requires all three, or even two, to exist.
 */
@Entity
@Table(name = "session")
@Getter
@Setter
public class Session {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "word_document_id")
    private UUID wordDocumentId;

    @Column(name = "jxml_document_id")
    private UUID jxmlDocumentId;

    @Column(name = "merged_document_id")
    private UUID mergedDocumentId;

    // The GitLab project selection (repo, entry point, selected files) the JXML slot was
    // generated from, if any — opaque JSON as far as the backend is concerned, only ever
    // written/read by the frontend, so the session id alone is enough to export/import it too.
    @Column(name = "gitlab_selection_json", columnDefinition = "TEXT")
    private String gitlabSelectionJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
