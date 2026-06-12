package com.pronocore.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "api-football")
public class ApiFootballProperties {
    private String baseUrl = "https://v3.football.api-sports.io";
    private String apiKey  = "";
    private int    leagueId = 1;
    private int    season   = 2026;
}
