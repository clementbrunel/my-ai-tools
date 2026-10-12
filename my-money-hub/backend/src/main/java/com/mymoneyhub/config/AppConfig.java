package com.mymoneyhub.config;

import com.mymoneyhub.connector.EnableBankingJwtSigner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({EnableBankingProperties.class, WoobProperties.class})
public class AppConfig {

    /** Every Enable Banking call is authenticated by a short-lived JWT signed with the application's key. */
    @Bean
    RestClient enableBankingRestClient(EnableBankingProperties props, EnableBankingJwtSigner jwtSigner) {
        return RestClient.builder()
                .baseUrl(props.baseUrl())
                .requestInterceptor((request, body, execution) -> {
                    request.getHeaders().set(HttpHeaders.AUTHORIZATION, "Bearer " + jwtSigner.token());
                    return execution.execute(request, body);
                })
                .build();
    }
}
