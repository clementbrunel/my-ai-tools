package com.mymoneyhub.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({EnableBankingProperties.class, WoobProperties.class})
public class AppConfig {

    @Bean
    RestClient enableBankingRestClient(EnableBankingProperties props) {
        return RestClient.builder().baseUrl(props.baseUrl()).build();
    }
}
