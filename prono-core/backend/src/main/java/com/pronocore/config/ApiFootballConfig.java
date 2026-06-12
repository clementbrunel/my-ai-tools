package com.pronocore.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(ApiFootballProperties.class)
public class ApiFootballConfig {

    @Bean(name = "apiFootballRestClient")
    public RestClient apiFootballRestClient(ApiFootballProperties props) {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(props.getBaseUrl());
        if (props.getApiKey() != null && !props.getApiKey().isBlank()) {
            builder.defaultHeader("x-apisports-key", props.getApiKey());
        }
        return builder.build();
    }
}
