package com.pronocore.service;

import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.Map;

/**
 * Bidirectional mapping between French team names stored in our DB and
 * the English names used by api-football.com.
 *
 * Used by MatchLinkingService to score fixture candidates and by
 * MatchSyncService to determine home/away goal mapping.
 */
@Component
public class TeamNameNormalizer {

    /** French DB name → api-football.com English name */
    private static final Map<String, String> FR_TO_API;
    /** api-football.com English name → French DB name (reverse lookup) */
    private static final Map<String, String> API_TO_FR;

    static {
        FR_TO_API = new HashMap<>();
        // Groupe A
        FR_TO_API.put("Mexique",              "Mexico");
        FR_TO_API.put("Corée du Sud",         "Korea Republic");
        FR_TO_API.put("Afrique du Sud",       "South Africa");
        FR_TO_API.put("République Tchèque",   "Czech Republic");
        // Groupe B
        FR_TO_API.put("Suisse",               "Switzerland");
        FR_TO_API.put("Canada",               "Canada");
        FR_TO_API.put("Bosnie-Herzégovine",   "Bosnia & Herzegovina");
        FR_TO_API.put("Qatar",                "Qatar");
        // Groupe C
        FR_TO_API.put("États-Unis",           "USA");
        FR_TO_API.put("Australie",            "Australia");
        FR_TO_API.put("Turquie",              "Turkey");
        FR_TO_API.put("Paraguay",             "Paraguay");
        // Groupe D
        FR_TO_API.put("Brésil",               "Brazil");
        FR_TO_API.put("Haïti",                "Haiti");
        FR_TO_API.put("Écosse",               "Scotland");
        FR_TO_API.put("Maroc",                "Morocco");
        // Groupe E
        FR_TO_API.put("Allemagne",            "Germany");
        FR_TO_API.put("Curaçao",              "Curaçao");
        FR_TO_API.put("Côte d'Ivoire",        "Ivory Coast");
        FR_TO_API.put("Équateur",             "Ecuador");
        // Groupe F
        FR_TO_API.put("Pays-Bas",             "Netherlands");
        FR_TO_API.put("Japon",                "Japan");
        FR_TO_API.put("Suède",                "Sweden");
        FR_TO_API.put("Tunisie",              "Tunisia");
        // Groupe G
        FR_TO_API.put("Espagne",              "Spain");
        FR_TO_API.put("Cap-Vert",             "Cape Verde");
        FR_TO_API.put("Arabie Saoudite",      "Saudi Arabia");
        FR_TO_API.put("Uruguay",              "Uruguay");
        // Groupe H
        FR_TO_API.put("Belgique",             "Belgium");
        FR_TO_API.put("Égypte",               "Egypt");
        FR_TO_API.put("Iran",                 "Iran");
        FR_TO_API.put("Nouvelle-Zélande",     "New Zealand");
        // Groupe I
        FR_TO_API.put("Angleterre",           "England");
        FR_TO_API.put("Croatie",              "Croatia");
        FR_TO_API.put("Ghana",                "Ghana");
        FR_TO_API.put("Panama",               "Panama");
        // Groupe J
        FR_TO_API.put("Portugal",             "Portugal");
        FR_TO_API.put("Colombie",             "Colombia");
        FR_TO_API.put("Ouzbékistan",          "Uzbekistan");
        FR_TO_API.put("RD Congo",             "DR Congo");
        // Groupe K
        FR_TO_API.put("Argentine",            "Argentina");
        FR_TO_API.put("Algérie",              "Algeria");
        FR_TO_API.put("Autriche",             "Austria");
        FR_TO_API.put("Jordanie",             "Jordan");
        // Groupe L
        FR_TO_API.put("France",               "France");
        FR_TO_API.put("Sénégal",              "Senegal");
        FR_TO_API.put("Irak",                 "Iraq");
        FR_TO_API.put("Norvège",              "Norway");

        API_TO_FR = new HashMap<>();
        FR_TO_API.forEach((fr, api) -> API_TO_FR.put(api.toLowerCase(), fr));
    }

    /**
     * Returns the api-football.com name for a given French team name.
     * Falls back to the original name if no mapping exists.
     */
    public String toApiName(String frenchName) {
        if (frenchName == null) return "";
        String mapped = FR_TO_API.get(frenchName);
        return mapped != null ? mapped : frenchName;
    }

    /**
     * Returns the French DB name for a given api-football.com name.
     * Falls back to the original name if no mapping exists.
     */
    public String toFrenchName(String apiName) {
        if (apiName == null) return "";
        String mapped = API_TO_FR.get(apiName.toLowerCase());
        return mapped != null ? mapped : apiName;
    }

    /**
     * Normalised form for fuzzy comparison: strip accents + lower-case.
     */
    public static String normalise(String s) {
        if (s == null) return "";
        String decomposed = Normalizer.normalize(s, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}", "").toLowerCase().trim();
    }

    /**
     * Similarity score [0.0 – 1.0] between two team names regardless of
     * FR/EN or accent differences.
     */
    public double similarity(String frName, String apiName) {
        String a = normalise(toApiName(frName));
        String b = normalise(apiName);
        if (a.equals(b)) return 1.0;
        // Partial containment check
        if (a.contains(b) || b.contains(a)) return 0.8;
        return 0.0;
    }
}
