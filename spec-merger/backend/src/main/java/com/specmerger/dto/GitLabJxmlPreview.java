package com.specmerger.dto;

import java.util.List;

/**
 * The flattened JXML (Include fragments resolved) the model will actually receive, plus any
 * warnings (unresolved Includes, incomplete tag nesting) worth surfacing to the user
 * separately from the content itself.
 */
public record GitLabJxmlPreview(String content, List<String> warnings) {
}
