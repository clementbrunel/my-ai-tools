package com.specmerger.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ansi.AnsiColor;
import org.springframework.boot.ansi.AnsiOutput;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpRequest;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Logs the raw HTTP request/response exchanged with the mistral-vibe gateway
 * (URL, headers with Authorization masked, pretty-printed body) so the exact
 * wire contract can be inspected while it's being confirmed with the platform
 * team. Requests are logged in cyan, successful responses in green, error
 * responses in red — easy to spot which is which in the console.
 */
@Slf4j
@Configuration
public class MistralHttpLoggingConfig {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Bean
    RestClientCustomizer mistralHttpLoggingCustomizer() {
        return builder -> builder.requestInterceptor(new LoggingInterceptor());
    }

    private static class LoggingInterceptor implements ClientHttpRequestInterceptor {

        @Override
        public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
                throws IOException {
            log.info(color(AnsiColor.CYAN, "mistral-vibe >>> REQUEST  {} {} headers={} body={}"),
                    request.getMethod(), request.getURI(), maskAuth(request), flatten(body));

            ClientHttpResponse response = execution.execute(request, body);
            byte[] responseBody = response.getBody().readAllBytes();
            HttpStatusCode status = response.getStatusCode();
            AnsiColor color = status.is2xxSuccessful() ? AnsiColor.GREEN : AnsiColor.RED;
            log.info(color(color, "mistral-vibe <<< RESPONSE {} headers={} body={}"),
                    status, response.getHeaders(), flatten(responseBody));

            return new BufferedClientHttpResponse(response, responseBody);
        }

        private String color(AnsiColor color, String text) {
            return AnsiOutput.toString(color, text, AnsiColor.DEFAULT);
        }

        private String flatten(byte[] body) {
            String raw = new String(body, StandardCharsets.UTF_8);
            if (raw.isBlank()) {
                return "[]";
            }
            try {
                JsonNode root = JSON.readTree(raw);
                StringBuilder sb = new StringBuilder("[");
                flattenInto(sb, "", root);
                if (sb.length() > 1) {
                    sb.setLength(sb.length() - 2);
                }
                return sb.append("]").toString();
            } catch (Exception e) {
                return raw;
            }
        }

        private void flattenInto(StringBuilder sb, String prefix, JsonNode node) {
            if (node.isObject()) {
                node.fields().forEachRemaining(entry -> {
                    String key = prefix.isEmpty() ? entry.getKey() : prefix + "." + entry.getKey();
                    flattenInto(sb, key, entry.getValue());
                });
            } else if (node.isArray()) {
                for (int i = 0; i < node.size(); i++) {
                    flattenInto(sb, prefix + "[" + i + "]", node.get(i));
                }
            } else {
                sb.append(prefix).append('=').append(node.isNull() ? "null" : node.asText()).append(", ");
            }
        }

        private String maskAuth(HttpRequest request) {
            var headers = new org.springframework.http.HttpHeaders();
            headers.addAll(request.getHeaders());
            if (headers.containsKey("Authorization")) {
                headers.set("Authorization", "*** masked ***");
            }
            return headers.toString();
        }
    }

    private record BufferedClientHttpResponse(ClientHttpResponse delegate, byte[] body) implements ClientHttpResponse {

        @Override
        public org.springframework.http.HttpStatusCode getStatusCode() throws IOException {
            return delegate.getStatusCode();
        }

        @Override
        public String getStatusText() throws IOException {
            return delegate.getStatusText();
        }

        @Override
        public void close() {
            delegate.close();
        }

        @Override
        public java.io.InputStream getBody() {
            return new ByteArrayInputStream(body);
        }

        @Override
        public org.springframework.http.HttpHeaders getHeaders() {
            return delegate.getHeaders();
        }
    }
}
