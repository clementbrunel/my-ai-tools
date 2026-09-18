package com.specmerger.dto;

import java.util.UUID;

/**
 * The two independently generated markdown specs to merge — as currently held by the frontend,
 * including any manual edit the user made to either before triggering the merge. The document
 * ids (if the frontend has them) are recorded on the resulting MERGED document for traceability
 * — best-effort, since the markdown sent may have since diverged from either document's latest
 * saved revision. {@code gitlabSelectionJson}, if the frontend has a GitLab project selected, is
 * stored alongside it (opaque to the backend) so the merged document's id alone is enough to
 * export/import the whole session — see {@link SessionExport}.
 */
public record MergeSpecsRequest(String wordMarkdown, String jxmlMarkdown, UUID wordDocumentId, UUID jxmlDocumentId,
                                 String gitlabSelectionJson) {
}
