# Recette Docker Desktop : scénarios manuels (issue #486)

Complète la recette automatisée (`npm run recette -- --source docker`, rapport `recette-docker.md`) avec ce qu'un script ne peut pas faire : arrêter Docker Desktop, changer de compte Windows. Les deux ensemble couvrent les 11 scénarios de l'issue.

## Couverture

| Scénario de l'issue | Où |
|---|---|
| Docker Desktop arrêté au lancement, puis démarré | **manuel** (M1) |
| Compte hors du groupe `docker-users` | **manuel** (M2) |
| Conteneur WebSphere de référence : format, niveaux, filtres, repli | auto D1 (format, niveaux) + **manuel** (M3, vrai conteneur) |
| 5 000 dernières lignes en moins de 0,3 s ; « Charger plus d'historique » | auto **D1** |
| Conteneur arrêté puis redémarré | auto **D5** |
| `docker compose up` qui recrée le conteneur | auto **D6** |
| Conteneur bavard 10 000 lignes/s (NF-04), Defender actif | auto **D2B** (CPU moteur, latence ; état de Defender consigné dans le rapport) |
| 8 conteneurs suivis (NF-11) | auto **D4** |
| Rotation du fichier tampon au plafond | auto **D3** (plafond abaissé à 1 Mio) ; **manuel** M4 pour le vrai plafond de 256 Mo |
| Redémarrage de Docker Desktop pendant le suivi | **manuel** (M5) |
| Fermeture d'onglet / relance : tampons nettoyés | auto **D7** |

## Jeu de test commun fichier ↔ Docker

Mêmes données, mêmes débits, mêmes durées, mêmes seuils (voir l'en-tête de `scripts/recette/docker.mjs`) :

| Fichier | Docker | Données |
|---|---|---|
| R1 | D1 | premières lignes du **même** log WebSphere généré (`npm run bench`) ; R1 indexe le fichier entier, D1 charge les 5 000 dernières lignes |
| R2 | D2 | 50 000 lignes de départ + 1 000 lignes/s pendant 20 s (`#seq#heure#`) |
| R2B | D2B | idem à 10 000 lignes/s pendant 10 s (NF-04) |
| R3 | D3 | 117 100 lignes, rotation à 1 Mio |
| R8 | D4 | 8 sources, 20 000 lignes écrites chacune |
| R7 | D7 | rouvrir l'appli |

`npm run recette -- --source both …` lance les deux recettes, ajoute une ligne `source: "file"` et une ligne `source: "docker"` à `history.jsonl`, puis écrit `comparaison.md` : fichier ↔ Docker (même commit), et itération précédente → dernière pour chaque source. `node scripts/recette/compare.mjs` regénère la comparaison sans rien relancer.

## Scénarios manuels

À exécuter sur le poste Windows avec Docker Desktop, avec **Defender actif**, sur l'application packagée (`release/win-unpacked/cbl-log.exe`). Noter date, commit et résultat.

| # | Scénario | Attendu | Résultat |
|---|---|---|---|
| M1 | Quitter Docker Desktop, lancer cbl-log (session avec onglets conteneur), puis démarrer Docker Desktop | panneau Docker « indisponible » avec message, connexion automatique au démarrage de Docker, onglets repris sans relancer cbl-log | |
| M2 | Lancer cbl-log avec un compte hors du groupe `docker-users` | message clair (accès refusé au démon, groupe à rejoindre), pas de plantage | |
| M3 | Ouvrir le conteneur WebSphere de référence (tout sur stdout) | `websphere-basic` détecté, niveaux colorés, filtres de niveau, repli des stack traces | |
| M4 | Conteneur bavard jusqu'au plafond de 256 Mo du tampon (`docker.spoolMaxMb` par défaut) | rotation, séparateur affiché, aucune ligne dupliquée, CPU stable | |
| M5 | Redémarrer Docker Desktop (menu de la zone de notification) pendant le suivi d'un conteneur qui écrit | reconnexion automatique, reprise sans doublon (comparer les numéros de séquence), séparateur « conteneur recréé » absent si le conteneur survit | |

Astuce pour M4/M5 : `docker run -d --name bavard --label cbl-log-recette -v "$PWD/scripts/recette:/s:ro" node:22-alpine node /s/docker-writer.mjs --rate 10000 --seconds 3600` (les lignes portent leur numéro de séquence : `#seq#`).

## Onglet « Tout » (M3, commentaire de l'issue #486)

Mesuré par la recette fichier (`npm run recette -- --only m1,m1b,m3 [--merge-size 200M|1G]`, scénarios dans `scripts/recette/merged.mjs`, historique et comparaison avec les autres scénarios) :

| Point du commentaire | Scénario |
|---|---|
| 2 puis 4 fichiers de 200 Mo à 1 Go : clic → première page, → fin de fusion, mémoire du moteur | **M1** (2 fichiers), **M1B** (4 fichiers) |
| Les autres onglets restent fluides pendant la fusion | M1 / M1B (images du premier onglet pendant la fusion, p99 ≤ 50 ms) |
| 8 sources en follow à 1 000 lignes/s avec « Tout » ouvert : délai d'apparition, CPU du moteur | **M3** |
| Cocher / décocher une source : durée de la refusion | M1 / M1B |

Les seuils sont ceux, indicatifs, du commentaire (première page < 1 s, fusion complète < 5 s, délai ≈ 2,25 s).

À faire à la main :

| # | Scénario | Résultat |
|---|---|---|
| M6 | Recherche et filtre dans « Tout » sur ce volume (premiers résultats, durée totale, à comparer à NF-05 : 1 Go filtré en < 3 s). **Non automatisé** : le filtre ne couvre pas encore l'onglet « Tout » (`App.tsx`, `applyFilter`). | |
| M7 | **Décision** : si la fusion initiale dépasse quelques secondes ou gêne les autres onglets (M1B), passer la lecture et le parsing des horodatages dans les workers (`docs/architecture.md` § 4.6). | |
