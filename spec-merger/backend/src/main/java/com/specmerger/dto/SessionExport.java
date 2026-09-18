package com.specmerger.dto;

import java.util.UUID;

/**
 * Everything needed to recover a session from another machine, from just one of its documents'
 * id — a finished merge, or a lone WORD/JXML generation with no counterpart to merge with yet.
 * On a merge: the merge itself, the two documents it was produced from (if still known — see
 * {@link com.specmerger.entity.GeneratedDocument}), and the GitLab project selection it was
 * generated from, if any. On a lone WORD/JXML document: only that document's own slot is filled
 * in, everything else is null. Backs the navbar's session export/import.
 */
public record SessionExport(UUID mergedDocumentId, String mergedMarkdown, UUID wordDocumentId, String wordMarkdown,
                             UUID jxmlDocumentId, String jxmlMarkdown, String gitlabSelectionJson) {
}
