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
            Map.entry("Mexique", "MX"), Map.entry("Panama", "PA"), Map.entry("Costa Rica", "CR"),
            Map.entry("Honduras", "HN"), Map.entry("Guatemala", "GT"), Map.entry("El Salvador", "SV"),
            Map.entry("Haïti", "HT"), Map.entry("Jamaïque", "JM"), Map.entry("Trinité-et-Tobago", "TT")
    );

    private static final Map<String, String> ISO2_TO_API_COUNTRY = new HashMap<>(Map.of(
            "GB-ENG", "England",
            "GB-SCT", "Scotland"
    ));

    private final ApiFootballClient apiFootballClient;

    private Map<String, Long> nameToIdCache;

    public Long getTeamId(String frenchName) {
        ensureCache();
        return nameToIdCache.get(frenchName);
    }

    public String getIso2(String frenchName) {
        return FR_NAME_TO_ISO2.get(frenchName);
    }

    private synchronized void ensureCache() {
        if (nameToIdCache != null) return;
        if (apiFootballClient.isDisabled()) {
            nameToIdCache = Map.of();
            return;
        }
        Map<String, Long> map = new HashMap<>();
        Map<String, String> iso2ToCountryName = buildIso2ToCountryName();
        for (ApiFootballClient.ApiTeam team : apiFootballClient.getTeams()) {
            for (Map.Entry<String, String> entry : FR_NAME_TO_ISO2.entrySet()) {
                String iso2 = entry.getValue();
                String countryName = iso2ToCountryName.getOrDefault(iso2,
                        ISO2_TO_API_COUNTRY.getOrDefault(iso2, iso2));
                if (team.countryIso2().equalsIgnoreCase(iso2)
                        || team.name().equalsIgnoreCase(countryName)) {
                    map.put(entry.getKey(), team.id());
                }
            }
        }
        nameToIdCache = map;
        log.info("TeamMappingService: resolved {} / {} French team names to api-football IDs",
                map.size(), FR_NAME_TO_ISO2.size());
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
