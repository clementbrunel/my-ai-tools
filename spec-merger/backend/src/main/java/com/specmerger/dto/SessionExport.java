package com.specmerger.dto;

import java.util.UUID;

/**
 * Everything needed to recover a finished merge from another machine, from just the merged
 * document's id: the merge itself, the two documents it was produced from (if still known — see
 * {@link com.specmerger.entity.GeneratedDocument}), and the GitLab project selection it was
 * generated from, if any. Backs the navbar's session export/import.
 */
public record SessionExport(UUID mergedDocumentId, String mergedMarkdown, UUID wordDocumentId, String wordMarkdown,
                             UUID jxmlDocumentId, String jxmlMarkdown, String gitlabSelectionJson) {
}
