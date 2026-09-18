package com.specmerger.dto;

/** A manual edit to auto-save as a new revision of an existing document (see #263). */
public record UpdateDocumentContentRequest(String content) {
}
