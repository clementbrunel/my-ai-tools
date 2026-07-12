package com.pronocore.service.f1;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class HttpJolpicaClient implements JolpicaClient {

    private final RestClient restClient;

    public HttpJolpicaClient(@Value("${f1.jolpica.base-url:https://api.jolpi.ca/ergast/f1}") String baseUrl) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
    }

    @Override
    public String get(String path) {
        return restClient.get().uri(path).retrieve().body(String.class);
    }
}
