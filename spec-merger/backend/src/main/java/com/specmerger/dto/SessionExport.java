package com.specmerger.dto;

import java.util.UUID;

/**
 * A session's id and the current content of whichever of its three slots (Word spec, JXML spec,
 * their merge) exist so far, plus the GitLab project selection it carries, if any. Recovers a
 * session from just its id — on another machine, or after a reload — whether or not a merge has
 * happened yet: an unfinished session (only one or two slots filled) comes back the same way a
 * finished one does, just with the missing slots left null. Backs the navbar's session
 * export/import.
 */
public record SessionExport(UUID sessionId, UUID wordDocumentId, String wordMarkdown, UUID jxmlDocumentId,
                             String jxmlMarkdown, UUID mergedDocumentId, String mergedMarkdown,
                             String gitlabSelectionJson) {
}
