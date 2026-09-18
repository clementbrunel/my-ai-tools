package com.specmerger.dto;

import java.util.UUID;

/**
 * Pairs a WORD document with a JXML document as belonging to the same in-progress session, before
 * either has been merged — so {@link SessionExport} can recover both from just one of their ids
 * without requiring an actual AI merge. See {@link com.specmerger.service.GeneratedDocumentService
 * #linkCounterparts}.
 */
public record LinkDocumentsRequest(UUID wordDocumentId, UUID jxmlDocumentId) {
}
