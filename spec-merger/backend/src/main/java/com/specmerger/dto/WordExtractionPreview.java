package com.specmerger.dto;

/** The raw text extracted from the uploaded Word/`.doc` spec, exactly as it will be sent to the model. */
public record WordExtractionPreview(String content) {
}
