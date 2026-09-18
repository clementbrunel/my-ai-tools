package com.specmerger.dto;

/**
 * The two independently generated markdown specs to merge — as currently held by the frontend,
 * including any manual edit the user made to either before triggering the merge.
 */
public record MergeSpecsRequest(String wordMarkdown, String jxmlMarkdown) {
}
