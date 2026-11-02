package com.specmerger.controller;

import com.specmerger.service.SessionNotFoundException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    /** Same body shape as the other errors ({ message }, see client.ts), so the UI shows it as is. */
    @ExceptionHandler(SessionNotFoundException.class)
    public ResponseEntity<Map<String, String>> sessionNotFound(SessionNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }
}
