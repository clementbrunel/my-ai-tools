package com.mymoneyhub.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mymoneyhub.dto.LinxoAccountChoice;
import com.mymoneyhub.dto.LinxoImportReport;
import com.mymoneyhub.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;
    private final ObjectMapper objectMapper;

    /**
     * Imports a Linxo CSV export. Defaults to {@code dryRun=true}: the report lists every account found with the
     * suggested action; call again with {@code dryRun=false} and {@code choices} (JSON array of
     * {@link LinxoAccountChoice}) to write.
     */
    @PostMapping(value = "/linxo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LinxoImportReport importLinxo(@RequestParam("file") MultipartFile file,
                                         @RequestParam(defaultValue = "true") boolean dryRun,
                                         @RequestParam(required = false) String choices) throws IOException {
        try {
            List<LinxoAccountChoice> parsedChoices = choices == null || choices.isBlank() ? List.of()
                    : objectMapper.readValue(choices, new TypeReference<>() {
                    });
            return importService.importLinxo(file.getBytes(), dryRun, parsedChoices);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "choices invalide : " + e.getOriginalMessage());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }
}
