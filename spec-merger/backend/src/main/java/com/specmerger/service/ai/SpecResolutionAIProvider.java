package com.specmerger.service.ai;

/**
 * Abstraction over the AI backend used to turn Word/JXML sources into markdown spec, and to
 * merge two such specs into one — so the pipeline doesn't couple to mistral-vibe specifically.
 */
public interface SpecResolutionAIProvider {

    /**
     * Generates a markdown spec from a démarche's resolved JXML (Include fragments already
     * flattened — see JxmlIncludeResolver), split by screen, assisted by the matching
     * jxml-tags/ reference so the model doesn't have to guess JWAY's proprietary syntax.
     */
    String generateSpecFromJxml(String resolvedJxml);

    /** Restructures the raw text extracted from a Word/Excel spec into the same markdown shape. */
    String generateSpecFromWord(String wordText);

    /**
     * Merges the two independently generated markdown specs (same gabarit — see
     * documentation-template.md) into a single reconciled one, screen by screen.
     */
    String mergeSpecs(String wordMarkdown, String jxmlMarkdown);
}
