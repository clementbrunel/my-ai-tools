package com.specmerger.service.ai;

/**
 * Abstraction over the AI backend used to propose a resolution for a Word/JXML
 * divergence, so the pipeline doesn't couple to mistral-vibe specifically.
 */
public interface SpecResolutionAIProvider {

    String proposeResolution(String wordExcerpt, String jxmlExcerpt);
}
