# Comparaison des recettes : itération précédente, fichier ↔ Docker

- Dernière recette **fichier** : 2026-11-02 2360e43f (précédente : 2026-10-21 cc77b2c)
- Dernière recette **Docker** : 2026-11-02 2360e43f

Plus bas = mieux, sauf mention contraire. Les scénarios jumeaux utilisent les mêmes lignes, débits, durées et seuils (voir `scripts/recette/docker.mjs`).

## 1. Fichier ↔ Docker (dernières recettes)

| Scénario jumeau | Mesure | Fichier | Docker | Écart Docker − fichier |
|---|---|---|---|---|
| R1 ↔ D1 | ouverture → affichage | 528.1 ms | 72.5 ms | -455.7 ms (-86 %) |
| R1 ↔ D1 | mémoire privée | 144 Mio | 135 Mio | -9 Mio (-6 %) |
| R2 ↔ D2 | latence écriture → affichage, p50 | 60 ms | 78.5 ms | +18.5 ms (+31 %) |
| R2 ↔ D2 | latence écriture → affichage, p95 | 109 ms | 99.5 ms | -9.5 ms (-9 %) |
| R2 ↔ D2 | durée des images, p99 | 18.7 ms | 19 ms | +0.3 ms (+2 %) |
| R2 ↔ D2 | CPU du moteur (% d'un cœur) | 1.5 % | 6.2 % | +4.7 % (+320 %) |
| R2 ↔ D2 | CPU de toute l'appli (% d'un cœur) | 16.4 % | 34.7 % | +18.3 % (+112 %) |
| R2 ↔ D2 | mémoire privée | 210 Mio | 216 Mio | +6 Mio (+3 %) |
| R2B ↔ D2B | latence écriture → affichage, p50 | 65 ms | 96.5 ms | +31.5 ms (+48 %) |
| R2B ↔ D2B | latence écriture → affichage, p95 | 110 ms | 133.5 ms | +23.5 ms (+21 %) |
| R2B ↔ D2B | durée des images, p99 | 35.6 ms | 19.1 ms | -16.5 ms (-46 %) |
| R2B ↔ D2B | CPU du moteur (% d'un cœur) | 4.2 % | 12.0 % | +7.8 % (+187 %) |
| R2B ↔ D2B | CPU de toute l'appli (% d'un cœur) | 26.1 % | 40.8 % | +14.6 % (+56 %) |
| R2B ↔ D2B | mémoire privée | 173 Mio | 238 Mio | +65 Mio (+38 %) |
| R3-RENAME ↔ D3 | lignes manquantes | 0 | 0 | = |
| R8 ↔ D4 | latence écriture → affichage, p95 | 121 ms | 119 ms | -2 ms (-2 %) |
| R8 ↔ D4 | durée des images, p99 | 18.6 ms | 19 ms | +0.4 ms (+2 %) |
| R8 ↔ D4 | CPU du moteur (% d'un cœur) | 16.7 % | 63.6 % | +46.9 % (+281 %) |
| R8 ↔ D4 | CPU de toute l'appli (% d'un cœur) | 41.1 % | 110.8 % | +69.7 % (+169 %) |
| R8 ↔ D4 | mémoire privée | 229 Mio | 275 Mio | +46 Mio (+20 %) |
| R8 ↔ D4 | lignes manquantes | 0 | 0 | = |

## 2. Recette fichier : itération précédente → dernière

| Scénario | Mesure | Précédente | Dernière | Écart |
|---|---|---|---|---|
| R1 | ouverture → affichage | 507 ms | 528.1 ms | +21.1 ms (+4 %) |
| R1 | mémoire privée | 137 Mio | 144 Mio | +7 Mio (+5 %) |
| R2 | latence écriture → affichage, p50 | 144 ms | 60 ms | -84 ms (-58 %) |
| R2 | latence écriture → affichage, p95 | 452 ms | 109 ms | -343 ms (-76 %) |
| R2 | durée des images, p99 | 19 ms | 18.7 ms | -0.3 ms (-2 %) |
| R2 | CPU du moteur (% d'un cœur) | — | 1.5 % | — |
| R2 | CPU de toute l'appli (% d'un cœur) | — | 16.4 % | — |
| R2 | mémoire privée | 207 Mio | 210 Mio | +3 Mio (+1 %) |
| R2B | latence écriture → affichage, p50 | — | 65 ms | première mesure |
| R2B | latence écriture → affichage, p95 | — | 110 ms | première mesure |
| R2B | durée des images, p99 | — | 35.6 ms | première mesure |
| R2B | CPU du moteur (% d'un cœur) | — | 4.2 % | première mesure |
| R2B | CPU de toute l'appli (% d'un cœur) | — | 26.1 % | première mesure |
| R2B | mémoire privée | — | 173 Mio | première mesure |
| R3-RENAME | lignes manquantes | 0 | 0 | = |
| R8 | latence écriture → affichage, p95 | — | 121 ms | — |
| R8 | durée des images, p99 | 18.1 ms | 18.6 ms | +0.5 ms (+3 %) |
| R8 | CPU du moteur (% d'un cœur) | — | 16.7 % | — |
| R8 | CPU de toute l'appli (% d'un cœur) | — | 41.1 % | — |
| R8 | mémoire privée | 221 Mio | 229 Mio | +8 Mio (+4 %) |
| R8 | lignes manquantes | — | 0 | — |
| M1 | « Tout » : clic → première page | — | 62.1 ms | première mesure |
| M1 | « Tout » : clic → fusion complète | — | 12366.8 ms | première mesure |
| M1 | « Tout » : refusion (source décochée) | — | 2965.3 ms | première mesure |
| M1 | mémoire du moteur | — | 172 Mio | première mesure |
| M1 | « Tout » : durée des images, p99 | — | 18.2 ms | première mesure |
| M1B | « Tout » : clic → première page | — | 60.6 ms | première mesure |
| M1B | « Tout » : clic → fusion complète | — | 22878.1 ms | première mesure |
| M1B | « Tout » : refusion (source décochée) | — | 8652.7 ms | première mesure |
| M1B | mémoire du moteur | — | 180 Mio | première mesure |
| M1B | « Tout » : durée des images, p99 | — | 18.6 ms | première mesure |
| M3 | mémoire du moteur | — | 191 Mio | première mesure |
| M3 | « Tout » : délai d'apparition, p50 | — | 2362 ms | première mesure |
| M3 | « Tout » : délai d'apparition, p95 | — | 2504 ms | première mesure |
| M3 | « Tout » : durée des images, p99 | — | 18.1 ms | première mesure |
| M3 | « Tout » : CPU du moteur (% d'un cœur) | — | 25.7 % | première mesure |
| M4 | mémoire du moteur | — | 192 Mio | première mesure |
| M4 | « Tout » : recherche, premiers résultats | — | 436.9 ms | première mesure |
| M4 | « Tout » : recherche, compteur stabilisé | — | 6103.7 ms | première mesure |
| M4 | « Tout » : filtre, premières lignes | — | 85.9 ms | première mesure |
| M4 | « Tout » : filtre, barre d'état stabilisée | — | 29276.0 ms | première mesure |

## 3. Recette Docker : itération précédente → dernière

| Scénario | Mesure | Précédente | Dernière | Écart |
|---|---|---|---|---|
| D1 | ouverture → affichage | — | 72.5 ms | première mesure |
| D1 | mémoire privée | — | 135 Mio | première mesure |
| D2 | latence écriture → affichage, p50 | — | 78.5 ms | première mesure |
| D2 | latence écriture → affichage, p95 | — | 99.5 ms | première mesure |
| D2 | durée des images, p99 | — | 19 ms | première mesure |
| D2 | CPU du moteur (% d'un cœur) | — | 6.2 % | première mesure |
| D2 | CPU de toute l'appli (% d'un cœur) | — | 34.7 % | première mesure |
| D2 | mémoire privée | — | 216 Mio | première mesure |
| D2B | latence écriture → affichage, p50 | — | 96.5 ms | première mesure |
| D2B | latence écriture → affichage, p95 | — | 133.5 ms | première mesure |
| D2B | durée des images, p99 | — | 19.1 ms | première mesure |
| D2B | CPU du moteur (% d'un cœur) | — | 12.0 % | première mesure |
| D2B | CPU de toute l'appli (% d'un cœur) | — | 40.8 % | première mesure |
| D2B | mémoire privée | — | 238 Mio | première mesure |
| D3 | lignes manquantes | — | 0 | première mesure |
| D4 | latence écriture → affichage, p95 | — | 119 ms | première mesure |
| D4 | durée des images, p99 | — | 19 ms | première mesure |
| D4 | CPU du moteur (% d'un cœur) | — | 63.6 % | première mesure |
| D4 | CPU de toute l'appli (% d'un cœur) | — | 110.8 % | première mesure |
| D4 | mémoire privée | — | 275 Mio | première mesure |
| D4 | lignes manquantes | — | 0 | première mesure |

## 4. Statut des scénarios (dernières recettes)

| Scénario | Fichier | Docker |
|---|---|---|
| R1 ↔ D1 | PASS | PASS |
| R2 ↔ D2 | PASS | PASS |
| R2B ↔ D2B | FAIL | FAIL |
| R3-RENAME ↔ D3 | PASS | PASS |
| R8 ↔ D4 | PASS | PASS |

> R1 ↔ D1 : pas la même mesure (R1 indexe un fichier de 1 Gio, D1 charge la fin d'un historique) ; l'écart indique un ordre de grandeur de l'ouverture, pas un surcoût.
