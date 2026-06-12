package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.client.ApiFootballClient.ApiTeam;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Builds and caches a mapping from ISO2 country codes to api-football team IDs.
 *
 * Flow (lazy, called on first use):
 *   1. GET /countries  → Map&lt;EN country name, ISO2&gt;
 *   2. GET /teams      → List of teams with their country names
 *   3. Correlate: team.country → ISO2 → team ID
 *
 * FR team names come from the same FR→ISO2 map already used in the frontend
 * (countryFlags.ts).  No manual FR→EN translation required.
 *
 * Special cases (England / Scotland use IANA subtag codes not in ISO 3166-1):
 *   "gb-eng" → look up team whose name is "England"
 *   "gb-sct" → look up team whose name is "Scotland"
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeamMappingService {

    // ----------------------------------------------------------------
    // FR name → ISO2  (mirrors frontend countryFlags.ts)
    // ----------------------------------------------------------------

    private static final Map<String, String> FR_TO_ISO2 = Map.ofEntries(
            Map.entry("Afrique du Sud",      "za"),
            Map.entry("Algérie",             "dz"),
            Map.entry("Allemagne",           "de"),
            Map.entry("Angleterre",          "gb-eng"),
            Map.entry("Arabie Saoudite",     "sa"),
            Map.entry("Argentine",           "ar"),
            Map.entry("Australie",           "au"),
            Map.entry("Autriche",            "at"),
            Map.entry("Belgique",            "be"),
            Map.entry("Bosnie-Herzégovine",  "ba"),
            Map.entry("Brésil",              "br"),
            Map.entry("Canada",              "ca"),
            Map.entry("Cap-Vert",            "cv"),
            Map.entry("Colombie",            "co"),
            Map.entry("Corée du Sud",        "kr"),
            Map.entry("Côte d'Ivoire",       "ci"),
            Map.entry("Croatie",             "hr"),
            Map.entry("Curaçao",             "cw"),
            Map.entry("Écosse",              "gb-sct"),
            Map.entry("Égypte",              "eg"),
            Map.entry("Équateur",            "ec"),
            Map.entry("Espagne",             "es"),
            Map.entry("États-Unis",          "us"),
            Map.entry("France",              "fr"),
            Map.entry("Ghana",               "gh"),
            Map.entry("Haïti",               "ht"),
            Map.entry("Irak",                "iq"),
            Map.entry("Iran",                "ir"),
            Map.entry("Japon",               "jp"),
            Map.entry("Jordanie",            "jo"),
            Map.entry("Maroc",               "ma"),
            Map.entry("Mexique",             "mx"),
            Map.entry("Norvège",             "no"),
            Map.entry("Nouvelle-Zélande",    "nz"),
            Map.entry("Ouzbékistan",         "uz"),
            Map.entry("Panama",              "pa"),
            Map.entry("Paraguay",            "py"),
            Map.entry("Pays-Bas",            "nl"),
            Map.entry("Portugal",            "pt"),
            Map.entry("Qatar",               "qa"),
            Map.entry("RD Congo",            "cd"),
            Map.entry("République Tchèque",  "cz"),
            Map.entry("Sénégal",             "sn"),
            Map.entry("Suède",               "se"),
            Map.entry("Suisse",              "ch"),
            Map.entry("Tunisie",             "tn"),
            Map.entry("Turquie",             "tr"),
            Map.entry("Uruguay",             "uy")
    );

    /**
     * ISO2 subtag codes that have no direct ISO 3166-1 equivalent.
     * Maps our internal code → the English team name used in api-football.
     */
    private static final Map<String, String> ISO2_TO_TEAM_NAME = Map.of(
            "gb-eng", "England",
            "gb-sct", "Scotland"
    );

    // ----------------------------------------------------------------

    private final ApiFootballClient apiClient;

    /** ISO2 → api-football team ID (null means API is disabled or build failed) */
    private Map<String, Long> iso2ToTeamId = null;

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------

    /**
     * Returns the api-football team ID for a French team name, if known.
     */
    public Optional<Long> getTeamId(String frenchName) {
        Map<String, Long> mapping = getMapping();
        if (mapping == null) return Optional.empty();

        String iso2 = FR_TO_ISO2.get(frenchName);
        if (iso2 == null) return Optional.empty();

        return Optional.ofNullable(mapping.get(iso2));
    }

    /** Returns the ISO2 code for a French team name. */
    public Optional<String> getIso2(String frenchName) {
        return Optional.ofNullable(FR_TO_ISO2.get(frenchName));
    }

    // ----------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------

    private synchronized Map<String, Long> getMapping() {
        if (iso2ToTeamId != null) return iso2ToTeamId;
        if (apiClient.isDisabled()) return null;

        try {
            Map<String, String> countryNameToIso2 = new HashMap<>(apiClient.getCountries());
            List<ApiTeam> teams = apiClient.getTeams();

            Map<String, Long> result = new HashMap<>();

            // Standard ISO2: country name from team → ISO2 from /countries → team ID
            for (ApiTeam team : teams) {
                String iso2 = countryNameToIso2.get(team.country());
                if (iso2 != null) {
                    result.put(iso2, team.teamId());
                }
            }

            // Special cases: IANA subtag codes (England, Scotland…)
            // Look up by English team name directly in the teams list
            for (Map.Entry<String, String> e : ISO2_TO_TEAM_NAME.entrySet()) {
                String subtag    = e.getKey();    // "gb-eng"
                String teamName  = e.getValue();  // "England"
                if (!result.containsKey(subtag)) {
                    teams.stream()
                            .filter(t -> teamName.equalsIgnoreCase(t.name()))
                            .findFirst()
                            .ifPresent(t -> result.put(subtag, t.teamId()));
                }
            }

            iso2ToTeamId = result;
            log.info("TeamMapping: {} teams resolved via ISO2", result.size());
            return result;
        } catch (Exception e) {
            log.warn("TeamMapping build failed: {}", e.getMessage());
            return null;
        }
    }
}
