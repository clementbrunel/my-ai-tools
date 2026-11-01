# Recette cbl-log : ce qui est mesuré

La recette (issue [#393](https://github.com/clementbrunel/my-ai-tools/issues/393)) déroule les critères d'acceptation du
[cahier des charges](../cahier-des-charges-fonctionnel.md) (§ 7) sur l'application **packagée**
(`release/win-unpacked/cbl-log.exe`), pilotée de l'extérieur par le protocole DevTools, avec un dossier de configuration
isolé (`CBL_LOG_USER_DATA`). Elle produit des chiffres, comparés **d'une itération à l'autre** et **entre fichier et
Docker**. Code : `scripts/recette/`.

| Fichier | Rôle |
|---|---|
| [`recette-mvp.md`](../recette-mvp.md) | Dernier rapport de la recette fichier (généré) |
| `recette-docker.md` | Dernier rapport de la recette Docker (généré) |
| `comparaison.md` | Itération précédente → dernière, et fichier ↔ Docker (généré) |
| `history.jsonl` | Une ligne par exécution et par source (`file` / `docker`) : date, commit, machine, état de Defender, résultats et valeurs numériques |

## Les trois familles de scénarios

### 1. Recette fichier (R1 à R8) : un log WebSphere généré

| # | Ce qui est mesuré | Seuil (PASS si…) |
|---|---|---|
| R1 | Ouvrir un fichier de 1 Gio (12,6 M de lignes) : durée jusqu'à l'affichage de la fin (hors relais de seconde instance), mémoire au repos et après 40 sauts aléatoires | fin < 1 s, mémoire privée < 400 Mio |
| R2 | 1 000 lignes/s pendant 20 s dans un fichier de 50 000 lignes : dernière ligne affichée, lignes comptées, latence écriture → affichage (p50, p95, max), durée des images (p99), CPU du moteur, mémoire | p95 ≤ 500 ms, p99 des images ≤ 50 ms, aucune ligne perdue |
| R2b | Idem à **10 000 lignes/s** pendant 10 s (NF-04) | p95 ≤ 100 ms, images ≤ 50 ms |
| R3 | Rolling rename + create, truncate, copytruncate : 10 rollings de 1 Mio (117 100 lignes) : lignes écrites / comptées / lisibles, doublons, désordre, séparateurs, erreurs côté écrivain | aucun doublon ni désordre, 10 séparateurs, aucune ligne manquante (sauf truncate sans archive) |
| R3b | Fichier vidé puis regrossi au-delà de l'ancienne taille entre deux contrôles | troncature détectée, aucune ligne mélangée |
| R4 | L'appli qui écrit renomme, copie, supprime, recrée le fichier suivi | aucun échec (pas de verrou), bandeau « fichier absent » puis reprise |
| R6 / R7 | Règle de surlignage désactivée à chaud et persistée ; fermer / rouvrir : onglets, onglet actif, position, follow | mêmes onglets, même position |
| R8 | 8 onglets de 128 Mio en follow à 1 000 lignes/s chacun pendant 20 s (NF-11) : lignes manquantes par onglet, mémoire, durée des images, latence, CPU | aucune ligne manquante, mémoire < 400 Mio, images ≤ 50 ms |

### 2. Recette Docker (D1 à D7) : les mêmes données, lues depuis des conteneurs

Mêmes lignes WebSphere générées, même format d'écrivain (`#seq#heure#`, écrit **dans** le conteneur par
`docker-writer.mjs`), mêmes débits, durées et seuils. Seule la source change : le stdout d'un conteneur Docker Desktop
(image `node:22-alpine`, conteneurs étiquetés `cbl-log-recette` et supprimés en fin de run).

| Docker | Jumeau fichier | Ce qui est mesuré | Seuil |
|---|---|---|---|
| D1 | R1 | Conteneur avec un long historique (début du même log généré) : double-clic → 5 000 lignes affichées et indexées, format détecté, niveaux, mémoire, **« Charger plus d'historique »** (×10) | 5 000 lignes en ≤ 300 ms, `websphere-basic` détecté |
| D2 | R2 | 1 000 lignes/s pendant 20 s après 50 000 lignes de départ (`initialTail` relevé pour garder les 50 000) | mêmes seuils que R2 |
| D2B | R2b | **Conteneur bavard à 10 000 lignes/s** (NF-04) : latence (corrigée du décalage d'horloge conteneur ↔ hôte), CPU du moteur et de l'appli, mémoire | p95 ≤ 100 ms, images ≤ 50 ms ; CPU du moteur ~2 % d'un cœur attendu |
| D3 | R3 | Rotation du tampon au plafond (abaissé à 1 Mio) pendant 117 100 lignes : lignes comptées, doublons, séparateurs | aucune ligne manquante ni dupliquée |
| D5 | – | Conteneur **arrêté puis redémarré** pendant le suivi | 10 000 lignes attendues, 0 perdue, 0 dupliquée |
| D6 | – | `docker compose up` qui **recrée** le conteneur (même nom, nouvel id) | même onglet, un séparateur « conteneur recréé », 0 doublon |
| D4 | R8 | **8 conteneurs** suivis à 1 000 lignes/s chacun (NF-11), ouverts depuis la session | 0 ligne manquante, mémoire < 400 Mio, images ≤ 50 ms |
| D7 | R7 | Onglets conteneur rouverts depuis la session ; tampon supprimé à la fermeture d'un onglet ; tampons orphelins purgés au lancement | 0 tampon restant |

Le **plafond de 256 Mo**, **Docker Desktop arrêté ou redémarré**, le **compte hors `docker-users`** et le **conteneur
WebSphere réel** restent manuels (§ « Scénarios manuels » ci-dessous). **Defender** : son état (actif / inactif) est
consigné dans chaque rapport ; la mesure NF-04 n'a de valeur qu'avec Defender actif.

### 3. Onglet « Tout » (M1 à M4) : la fusion par horodatage

Fichiers copiés d'un log généré (`--merge-size`, 200M par défaut, jusqu'à 1G), format horodaté.

| # | Ce qui est mesuré | Seuil indicatif |
|---|---|---|
| M1 / M1B | 2 puis 4 fichiers : clic → première page, clic → fusion complète, mémoire du moteur (≈ 1 octet par ligne fusionnée attendu), fluidité d'un autre onglet pendant la fusion, durée de la refusion en décochant puis recochant une source | première page < 1 s, fusion < 5 s, images ≤ 50 ms |
| M3 | 8 sources en follow à 1 000 lignes/s chacune avec « Tout » ouvert (NF-11) : délai d'apparition, CPU et mémoire du moteur | p95 ≤ 2,75 s (fenêtre de 2 s + tick de 250 ms) |
| M4 | Recherche et filtre dans « Tout » (4 fichiers) : premiers résultats, compteur / barre d'état stabilisés (à comparer à NF-05 : 1 Go filtré en < 3 s sur un fichier seul) | premiers résultats < 1 s |

**Décision attendue** : si la fusion initiale dépasse quelques secondes ou gêne les autres onglets (M1B), déplacer la
lecture et le parsing des horodatages dans les workers existants ([architecture § 4.6](../architecture.md)).

## Scénarios manuels

Ce qu'un script ne peut pas faire (arrêter Docker Desktop, changer de compte Windows). À exécuter sur le poste Windows avec
Docker Desktop, avec **Defender actif**, sur l'application packagée ; noter la date, le commit et le résultat.

| # | Scénario | Attendu | Résultat |
|---|---|---|---|
| X1 | Quitter Docker Desktop, lancer cbl-log (session avec onglets conteneur), puis démarrer Docker Desktop | panneau Docker « indisponible » avec message, connexion automatique au démarrage de Docker, onglets repris sans relancer cbl-log | |
| X2 | Lancer cbl-log avec un compte hors du groupe `docker-users` | message clair (accès refusé au démon, groupe à rejoindre), pas de plantage | |
| X3 | Ouvrir le conteneur WebSphere de référence (tout sur stdout) | `websphere-basic` détecté, niveaux colorés, filtres de niveau, repli des stack traces | |
| X4 | Conteneur bavard jusqu'au plafond de 256 Mo du tampon (`docker.spoolMaxMb` par défaut) | rotation, séparateur affiché, aucune ligne dupliquée, CPU stable | |
| X5 | Redémarrer Docker Desktop (menu de la zone de notification) pendant le suivi d'un conteneur qui écrit | reconnexion automatique, reprise sans doublon (comparer les numéros de séquence), séparateur « conteneur recréé » absent si le conteneur survit | |

Pour X4 et X5, un conteneur bavard dont les lignes portent leur numéro de séquence (`#seq#`) :
`docker run -d --name bavard --label cbl-log-recette -v "$PWD/scripts/recette:/s:ro" node:22-alpine node /s/docker-writer.mjs --rate 10000 --seconds 3600`.

## Comparer

`comparaison.md` rassemble trois tableaux, à partir de `history.jsonl` :

1. **Fichier ↔ Docker** (dernières exécutions) pour chaque couple jumeau (R1/D1, R2/D2, R2b/D2B, R3/D3, R8/D4) : latence p50 et
   p95, images p99, CPU du moteur, mémoire, lignes manquantes. R1 ↔ D1 n'est pas une comparaison de surcoût (R1 indexe
   1 Gio, D1 charge la fin d'un historique) : elle donne un ordre de grandeur de l'ouverture.
2. **Fichier : itération précédente → dernière**, avec l'écart absolu et relatif.
3. **Docker : itération précédente → dernière**.

Les valeurs numériques (`values`) sont enregistrées avec chaque résultat ; les exécutions plus anciennes sans `values`
sont relues depuis leur texte. Une dérive visible dans le tableau 2 ou 3 d'un commit à l'autre est une régression.

## Lancer

Prérequis : `npm run package:dir`, `npm run bench -- --size 1G --generate-only` (compile le banc et prépare le log) et, pour
Docker, **Docker Desktop lancé**.

```bash
cd cbl-log
npm run recette -- --source both --size 1G \
  --out docs/recette-mvp.md --docker-out docs/recette/recette-docker.md \
  --compare-out docs/recette/comparaison.md --history docs/recette/history.jsonl
npm run recette -- --source file --only r2b,m1b          # une partie seulement
npm run recette -- --source docker --only d2b,d4
node scripts/recette/compare.mjs --out docs/recette/comparaison.md   # regénère la comparaison sans rien relancer
```

| Option | Rôle |
|---|---|
| `--source file\|docker\|both` | recette fichier (R*, M*), recette Docker (D*), ou les deux suivies de la comparaison |
| `--only` | ids séparés par des virgules : `r1,r2,r2b,r3,r3t,r3c,r3b,r4,r67,r8,m1,m1b,m3,m4,d1,d2,d2b,d3,d5,d4,d7` |
| `--size` | taille du fichier de R1 (`1G`) ; `--docker-seed` (historique de D1, `128M`) ; `--merge-size` (« Tout », `200M`) |
| `--docker-image` | image des conteneurs de test (`node:22-alpine`) |
| `--history`, `--out`, `--docker-out`, `--compare-out` | fichiers écrits |

Limites connues : mesure sur 1 Gio au lieu de 10 Gio (R1 extrapole), écrivain simulé au lieu d'un vrai conteneur WebSphere
Liberty (critère 3), partage SMB du NAS non mesuré, latences à la résolution de l'échantillonneur de l'UI (~100 ms).
