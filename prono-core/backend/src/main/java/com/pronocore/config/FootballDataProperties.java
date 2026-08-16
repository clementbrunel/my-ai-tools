package com.pronocore.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "football-data")
@Getter
@Setter
public class FootballDataProperties {
    private String baseUrl = "https://api.football-data.org/v4";
    private String apiKey = "";
}
