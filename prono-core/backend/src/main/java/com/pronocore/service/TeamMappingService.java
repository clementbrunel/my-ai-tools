package com.pronocore.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.pronocore.client.ApiFootballClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Resolves French team names (as stored in the DB) to api-football team IDs.
 * Builds the mapping on first call and caches it for the process lifetime.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeamMappingService {

    private static final Map<String, String> FR_NAME_TO_ISO2 = Map.ofEntries(
            Map.entry("France", "FR"), Map.entry("Brésil", "BR"), Map.entry("Argentine", "AR"),
            Map.entry("Allemagne", "DE"), Map.entry("Espagne", "ES"), Map.entry("Portugal", "PT"),
            Map.entry("Angleterre", "GB-ENG"), Map.entry("Pays-Bas", "NL"), Map.entry("Belgique", "BE"),
            Map.entry("Italie", "IT"), Map.entry("Croatie", "HR"), Map.entry("Maroc", "MA"),
            Map.entry("Sénégal", "SN"), Map.entry("Uruguay", "UY"), Map.entry("Mexique", "MX"),
            Map.entry("États-Unis", "US"), Map.entry("Canada", "CA"), Map.entry("Australie", "AU"),
            Map.entry("Japon", "JP"), Map.entry("Corée du Sud", "KR"), Map.entry("Suisse", "CH"),
            Map.entry("Danemark", "DK"), Map.entry("Pologne", "PL"), Map.entry("Serbie", "RS"),
            Map.entry("Ghana", "GH"), Map.entry("Cameroun", "CM"), Map.entry("Tunisie", "TN"),
            Map.entry("Nigeria", "NG"), Map.entry("Égypte", "EG"), Map.entry("Côte d'Ivoire", "CI"),
            Map.entry("Écosse", "GB-SCT"), Map.entry("Turquie", "TR"), Map.entry("Autriche", "AT"),
            Map.entry("Colombie", "CO"), Map.entry("Équateur", "EC"), Map.entry("Chili", "CL"),
            Map.entry("Paraguay", "PY"), Map.entry("Pérou", "PE"), Map.entry("Bolivie", "BO"),
            Map.entry("Venezuela", "VE"), Map.entry("Nouvelle-Zélande", "NZ"),
            Map.entry("Arabie saoudite", "SA"), Map.entry("Iran", "IR"), Map.entry("Qatar", "QA"),
            Map.entry("Panama", "PA"), Map.entry("Costa Rica", "CR"),
            Map.entry("Honduras", "HN"), Map.entry("Guatemala", "GT"), Map.entry("El Salvador", "SV"),
            Map.entry("Haïti", "HT"), Map.entry("Jamaïque", "JM"), Map.entry("Trinité-et-Tobago", "TT")
    );

    private static final Map<String, String> ISO2_TO_API_COUNTRY = new HashMap<>(Map.of(
            "GB-ENG", "England",
            "GB-SCT", "Scotland"
    ));

    private final ApiFootballClient apiFootballClient;

    /** Keyed per (leagueId, season): each football competition has its own team roster. */
    private final Map<String, Map<String, Long>> nameToIdCacheByLeagueSeason = new HashMap<>();

    /**
     * Resolves a team name to its api-football id within a given league/season.
     * Handles both national teams (French country name, e.g. World Cup) via
     * {@link #FR_NAME_TO_ISO2} and club teams (Ligue 1 and the like) by direct
     * case-insensitive name match against the league's roster.
     */
    public Long getTeamId(String name, int leagueId, int season) {
        return ensureCache(leagueId, season).get(name.toLowerCase());
    }

    public String getIso2(String frenchName) {
        return FR_NAME_TO_ISO2.get(frenchName);
    }

    private synchronized Map<String, Long> ensureCache(int leagueId, int season) {
        String key = leagueId + ":" + season;
        Map<String, Long> cached = nameToIdCacheByLeagueSeason.get(key);
        if (cached != null) return cached;

        Map<String, Long> map = buildCache(leagueId, season);
        nameToIdCacheByLeagueSeason.put(key, map);
        return map;
    }

    private Map<String, Long> buildCache(int leagueId, int season) {
        if (apiFootballClient.isDisabled()) return Map.of();

        Map<String, Long> map = new HashMap<>();
        Map<String, String> iso2ToCountryName = buildIso2ToCountryName();
        for (ApiFootballClient.ApiTeam team : apiFootballClient.getTeams(leagueId, season)) {
            // Club teams (Ligue 1...): the stored name is already the api-football name.
            map.put(team.name().toLowerCase(), team.id());

            // National teams (World Cup...): translate the French country name via ISO2.
            for (Map.Entry<String, String> entry : FR_NAME_TO_ISO2.entrySet()) {
                String iso2 = entry.getValue();
                String countryName = iso2ToCountryName.getOrDefault(iso2,
                        ISO2_TO_API_COUNTRY.getOrDefault(iso2, iso2));
                if (team.countryIso2().equalsIgnoreCase(iso2)
                        || team.name().equalsIgnoreCase(countryName)) {
                    map.put(entry.getKey().toLowerCase(), team.id());
                }
            }
        }
        log.info("TeamMappingService: resolved {} team name(s) to api-football IDs for league {} season {}",
                map.size(), leagueId, season);
        return map;
    }

    private Map<String, String> buildIso2ToCountryName() {
        Map<String, String> result = new HashMap<>();
        try {
            for (JsonNode country : apiFootballClient.getCountries()) {
                String code = country.path("code").asText("");
                String name = country.path("name").asText("");
                if (!code.isBlank()) result.put(code.toUpperCase(), name);
            }
        } catch (Exception e) {
            log.warn("Could not load countries from api-football: {}", e.getMessage());
        }
        result.putAll(ISO2_TO_API_COUNTRY);
        return result;
    }
}
