package com.specmerger.dto;

import java.util.UUID;

/**
 * The two independently generated markdown specs to merge — as currently held by the frontend,
 * including any manual edit the user made to either before triggering the merge. {@code
 * sessionId} is the session both were generated under (already carrying their document ids — see
 * {@link com.specmerger.entity.Session}); the resulting MERGED document is attached to it too.
 * {@code gitlabSelectionJson}, if the frontend has a GitLab project selected, is recorded on the
 * session alongside it (opaque to the backend) so the session id alone is enough to export/import
 * the whole thing — see {@link SessionExport}.
 */
public record MergeSpecsRequest(String wordMarkdown, String jxmlMarkdown, UUID sessionId,
                                 String gitlabSelectionJson) {
}
