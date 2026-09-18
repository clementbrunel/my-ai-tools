package com.specmerger.dto;

/** A divergence before it is persisted — sectionRef groups excerpts under the same screen/feature. */
public record DivergenceDraft(String sectionRef, String wordExcerpt, String jxmlExcerpt) {
}
