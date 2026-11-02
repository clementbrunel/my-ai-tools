# Recette MVP cbl-log (critères P0, cahier des charges § 7)

Exécutée le 2026-11-02 sur l'application **packagée** (`release/win-unpacked/cbl-log.exe`), version 3.0.0, par `npm run recette` (`scripts/recette/`).

Machine : Intel(R) Core(TM) i5-14600KF (20 threads), 32 Go de RAM, Windows 10.0.26300 win32.
Windows Defender (protection en temps réel) : actif.
Commit mesuré : 2360e43f.
Fichier de référence : log WebSphere généré (`npm run bench`), 1G au lieu des 10 Go du critère 1.

| # | Critère | Résultat |
|---|---------|----------|
| R1 | Ouvrir un fichier de 1G (WebSphere généré) | ✅ PASS |
| R2 | 1 000 lignes/s en continu (20 s, follow) | ✅ PASS |
| R2B | 10 000 lignes/s en continu (NF-04, 10 s, follow) | ❌ FAIL |
| R3-RENAME | Rolling rename + create, 10 rollings de 1 Mio | ✅ PASS |
| R3-TRUNCATE | Rolling truncate pendant l'écriture, 10 rollings de 1 Mio | ✅ PASS |
| R3-COPYTRUNCATE | Rolling copytruncate, 10 rollings de 1 Mio | ✅ PASS |
| R3B | Fichier vidé puis regrossi au-delà de l'ancienne taille entre deux contrôles | ✅ PASS |
| R4 | Pas de verrou pendant le suivi | ✅ PASS |
| R6 | Règles de surlignage regex | ✅ PASS |
| R7 | Fermer / rouvrir l'appli | ✅ PASS |
| R8 | 8 onglets en follow simultané (1 000 lignes/s chacun, 20 s) | ✅ PASS |
| M1 | Onglet « Tout » : 2 fichiers de 200M | ✅ PASS |
| M1B | Onglet « Tout » : 4 fichiers de 200M | ✅ PASS |
| M3 | Onglet « Tout » : 8 sources en follow à 1 000 lignes/s chacune (NF-11) | ✅ PASS |
| M4 | Onglet « Tout » : recherche et filtre sur 4 fichiers de 200M | ✅ PASS |

## R1 — Ouvrir un fichier de 1G (WebSphere généré)

Critère : fin affichée < 1 s ; mémoire totale < 400 Mo.

| Mesure | Valeur |
|---|---|
| taille | 1.00 Gio, 12 593 583 lignes |
| ouverture → fin affichée | 639 ms (dont ~111 ms de relais de seconde instance mesurés sur un fichier de 10 lignes) → ~528 ms |
| mémoire privée, au repos | 144 Mio (5 processus ; working set 454 Mio) |
| mémoire privée, après 40 sauts aléatoires | 237 Mio (working set 555 Mio) |

> Le fichier vient d'être généré : il est dans le cache disque de l'OS (une lecture à froid sera plus lente).

> La fin n'est affichée qu'une fois l'indexation initiale terminée, donc le délai croît avec la taille : extrapolé linéairement à 10 Gio, ~5.3 s, au-dessus de la cible de 1 s. L'ouverture affiche un loader avec le pourcentage d'indexation ; l'affichage immédiat de la fin (F-03, #406) est volontairement reporté.

> Mémoire : « privée » = working set privé cumulé des processus cbl-log (colonne « Mémoire » du Gestionnaire des tâches) ; le « working set » total compte aussi les pages partagées entre processus.

## R2 — 1 000 lignes/s en continu (20 s, follow)

Critère : l'affichage suit en continu, l'UI reste fluide.

| Mesure | Valeur |
|---|---|
| dernière ligne affichée | #19999 (attendu #19999) |
| lignes dans l'onglet | 70 000 (attendu 70 000) |
| latence écriture → affichage | p50 60 ms, p95 109 ms, max 278 ms (seuil p95 ≤ 500 ms) |
| durée des images | p99 18.7 ms, 1 images > 100 ms sur 1357 (seuil p99 ≤ 50 ms) |
| CPU pendant l'écriture (% d'un cœur) | moteur 1.5 %, toute l'appli 16.4 % |
| mémoire privée | 210 Mio |

## R2B — 10 000 lignes/s en continu (NF-04, 10 s, follow)

Critère : délai d'affichage ≤ 100 ms (p95), UI fluide ; jumeau de D2B.

| Mesure | Valeur |
|---|---|
| dernière ligne affichée | #99999 (attendu #99999) |
| lignes dans l'onglet | 150 000 (attendu 150 000) |
| latence écriture → affichage | p50 65 ms, p95 110 ms, max 112 ms (seuil p95 ≤ 100 ms) |
| durée des images | p99 35.6 ms, 3 images > 100 ms sur 381 (seuil p99 ≤ 50 ms) |
| CPU pendant l'écriture (% d'un cœur) | moteur 4.2 %, toute l'appli 26.1 % |
| mémoire privée | 173 Mio |

## R3-RENAME — Rolling rename + create, 10 rollings de 1 Mio

Critère : le rolling réussit à chaque fois côté serveur, aucune ligne dupliquée, séparateur affiché, aucune ligne perdue.

| Mesure | Valeur |
|---|---|
| lignes écrites | 117 100 (10 rollings de 1 Mio) |
| lignes comptées par l'onglet | 117 100 (manquantes : 0) |
| lignes encore lisibles (copie de tout l'onglet) | 117 100 |
| erreurs côté écrivain (rename / truncate / copie / ouverture) | aucune |
| doublons / désordre dans les lignes lisibles | 0 / 0 |
| séparateurs de rolling affichés | 10 sur 10 |

## R3-TRUNCATE — Rolling truncate pendant l'écriture, 10 rollings de 1 Mio

Critère : le rolling réussit à chaque fois côté serveur, aucune ligne dupliquée, séparateur affiché.

| Mesure | Valeur |
|---|---|
| lignes écrites | 117 100 (10 rollings de 1 Mio) |
| lignes comptées par l'onglet | 112 900 (manquantes : 4 200) |
| lignes encore lisibles (copie de tout l'onglet) | 100 |
| erreurs côté écrivain (rename / truncate / copie / ouverture) | aucune |
| doublons / désordre dans les lignes lisibles | 0 / 0 |
| séparateurs de rolling affichés | 10 sur 10 |

> Après une troncature sans archive, les lignes des fichiers précédents restent comptées mais ne sont plus lisibles (leur contenu a disparu).

> Troncature sans archive pendant l'écriture : des lignes écrites entre deux contrôles peuvent disparaître avec le fichier (inhérent au truncate) ; doublons et désordre restent bloquants.

## R3-COPYTRUNCATE — Rolling copytruncate, 10 rollings de 1 Mio

Critère : le rolling réussit à chaque fois côté serveur, aucune ligne dupliquée, séparateur affiché, aucune ligne perdue.

| Mesure | Valeur |
|---|---|
| lignes écrites | 117 100 (10 rollings de 1 Mio) |
| lignes comptées par l'onglet | 117 100 (manquantes : 0) |
| lignes encore lisibles (copie de tout l'onglet) | 117 100 |
| erreurs côté écrivain (rename / truncate / copie / ouverture) | aucune |
| doublons / désordre dans les lignes lisibles | 0 / 0 |
| séparateurs de rolling affichés | 10 sur 10 |

## R3B — Fichier vidé puis regrossi au-delà de l'ancienne taille entre deux contrôles

Critère : la troncature est détectée, pas de lignes mélangées.

| Mesure | Valeur |
|---|---|
| lignes NEW lisibles | 800 sur 800 |
| lignes corrompues ou mélangées | 0 |
| lignes comptées dans l'onglet | 1300 |

## R4 — Pas de verrou pendant le suivi

Critère : l'appli qui écrit peut renommer / supprimer le fichier.

| Mesure | Valeur |
|---|---|
| opérations tentées pendant que cbl-log suit | ajout, renommage, recréation, copie, suppression de l'archive et du fichier suivi, recréation |
| échecs | aucun |
| bandeau « fichier absent » puis reprise | oui |

## R6 — Règles de surlignage regex

Critère : appliquées, modifiables à chaud, persistées.

| Mesure | Valeur |
|---|---|
| lignes colorées (ERROR actif → règle désactivée à chaud) | 6 → 0 |
| règle enregistrée dans rules/default.json | oui (enabled: false) |
| lignes colorées après redémarrage | 0 |

## R7 — Fermer / rouvrir l'appli

Critère : mêmes onglets, mêmes positions, mêmes règles.

| Mesure | Valeur |
|---|---|
| onglets rouverts | 2 sur 2 |
| onglet actif | b.log |
| première ligne affichée (avant → après redémarrage) | 1448 → 1448 |
| follow (avant → après) | coupé → coupé |

## R8 — 8 onglets en follow simultané (1 000 lignes/s chacun, 20 s)

Critère : UI fluide, mémoire < 400 Mo.

| Mesure | Valeur |
|---|---|
| contenu préexistant | 8 × 128 Mio = 1.00 Gio |
| lignes écrites par onglet | 20 000 (160 000 au total) |
| lignes manquantes par onglet | 0, 0, 0, 0, 0, 0, 0, 0 |
| mémoire privée, avant → pendant/après | 207 → 229 Mio (5 processus ; working set 550 Mio) |
| durée des images (onglet actif) | p99 18.6 ms, 0 images > 100 ms sur 1392 (seuil p99 ≤ 50 ms) |
| latence écriture → affichage (onglet actif) | p95 121 ms |
| CPU pendant l'écriture (% d'un cœur) | moteur 16.7 %, toute l'appli 41.1 % |

## M1 — Onglet « Tout » : 2 fichiers de 200M

Critère : première page < 1000 ms, fenêtre par défaut affichée < 5 s (seuils indicatifs), les autres onglets restent fluides (p99 ≤ 50 ms) ; tout l'historique chargeable.

| Mesure | Valeur |
|---|---|
| contenu | 2 × 200M = 4 915 960 lignes |
| clic → première page | 62 ms (seuil 1000 ms) |
| clic → fenêtre par défaut fusionnée | 524 ms, 399 988 lignes (seuil 5000 ms) |
| mémoire du moteur, avant → après la fenêtre | 33 → 102 Mio |
| tout l'historique (clics sur « Charger plus d'historique ») | 12367 ms pour 4 915 960 lignes sur 4 915 960 (attente de stabilité de 0,6 s par étape comprise) |
| mémoire du moteur, historique complet | 172 Mio (≈ 29.65 octet par ligne fusionnée ; attendu ~1) |
| fluidité d'un autre onglet pendant la fusion | p99 18.2 ms, max 18 ms, 0 images > 100 ms sur 66 |
| décocher une source (refusion) | 2965 ms |
| recocher la source (refusion) | 5757 ms |

> Décision (issue #393) : si la fusion initiale dépasse quelques secondes ou gêne les autres onglets, passer la lecture et le parsing des horodatages dans les workers existants.

> Fichiers copiés du même log généré : les horodatages se recoupent, cas le plus défavorable pour l'entrelacement.

## M1B — Onglet « Tout » : 4 fichiers de 200M

Critère : première page < 1000 ms, fenêtre par défaut affichée < 5 s (seuils indicatifs), les autres onglets restent fluides (p99 ≤ 50 ms) ; tout l'historique chargeable.

| Mesure | Valeur |
|---|---|
| contenu | 4 × 200M = 9 831 920 lignes |
| clic → première page | 61 ms (seuil 1000 ms) |
| clic → fenêtre par défaut fusionnée | 1015 ms, 799 976 lignes (seuil 5000 ms) |
| mémoire du moteur, avant → après la fenêtre | 36 → 168 Mio |
| tout l'historique (clics sur « Charger plus d'historique ») | 22878 ms pour 9 831 920 lignes sur 9 831 920 (attente de stabilité de 0,6 s par étape comprise) |
| mémoire du moteur, historique complet | 180 Mio (≈ 15.36 octet par ligne fusionnée ; attendu ~1) |
| fluidité d'un autre onglet pendant la fusion | p99 18.6 ms, max 19 ms, 0 images > 100 ms sur 95 |
| décocher une source (refusion) | 8653 ms |
| recocher la source (refusion) | 11604 ms |

> Décision (issue #393) : si la fusion initiale dépasse quelques secondes ou gêne les autres onglets, passer la lecture et le parsing des horodatages dans les workers existants.

> Fichiers copiés du même log généré : les horodatages se recoupent, cas le plus défavorable pour l'entrelacement.

## M3 — Onglet « Tout » : 8 sources en follow à 1 000 lignes/s chacune (NF-11)

Critère : toutes les lignes apparaissent, délai ≈ fenêtre de 2 s + 250 ms (p95 ≤ 2,75 s), UI fluide.

| Mesure | Valeur |
|---|---|
| lignes dans « Tout » | 1 759 952 (attendu 1 759 952) |
| délai écriture → apparition | p50 2362 ms, p95 2504 ms, max 2545 ms (seuil p95 ≤ 2 750 ms) |
| durée des images | p99 18.1 ms, 0 images > 100 ms sur 1480 |
| CPU pendant l'écriture (% d'un cœur) | moteur 25.7 %, toute l'appli 36.9 % |
| mémoire du moteur | 191 Mio |

## M4 — Onglet « Tout » : recherche et filtre sur 4 fichiers de 200M

Critère : premiers résultats < 1 s, durée totale à comparer à NF-05 (1 Go filtré en < 3 s sur un fichier seul).

| Mesure | Valeur |
|---|---|
| contenu | 4 × 200M = 9 831 920 lignes ; motif « ServletWrappe » |
| recherche : premiers résultats | 437 ms (seuil 1 000 ms) |
| recherche : compteur stabilisé | 6104 ms (« 831 088 résultats ») |
| filtre : premières lignes filtrées | 86 ms (seuil 1 000 ms) |
| filtre : barre d'état stabilisée | 29276 ms |
| mémoire du moteur | 193 Mio |

> « Stabilisé » = valeur inchangée pendant 800 ms (l'interface ne signale pas explicitement la fin) ; durée totale = instant du dernier changement.

## Non réalisé dans cette passe

- **Critère 1 à 10 Gio** : mesuré sur 1 Gio (extrapolation dans R1).
- **Critère 3 avec un vrai conteneur WebSphere Liberty** (`icr.io/appcafe/open-liberty`, bind mount, `maxFileSize=1`) : remplacé par l'écrivain simulé du banc (`packages/engine/test/fixtures/rolling-writer.mjs`), qui reproduit les trois modes de rolling mais pas le comportement exact d'un serveur.
- **Critère 5** (volume Docker Desktop et partage SMB du NAS) : le suivi de conteneurs Docker est mesuré par la recette Docker (`--source docker`, `docs/recette/recette-docker.md`) ; le partage SMB du NAS reste hors de portée de cette machine (polling couvert côté moteur : `PollScheduler`, `LOCAL_POLL_MS` / `UNC_POLL_MS`).
- **Critère 8 à 10 Gio au total** (NF-11 complet) : mesuré avec 8 fichiers de 128 Mio (1 Gio au total).

## Comment relancer

```bash
cd cbl-log
npm run package:dir                       # construit release/win-unpacked/cbl-log.exe
npm run bench -- --size 1G --generate-only # compile le banc (générateur + écrivain) et prépare le log
npm run recette -- --size 1G --out docs/recette-mvp.md --history docs/recette/history.jsonl [--only r1,r2,r2b,r3,r3t,r3c,r3b,r4,r67,r8]
```

L'application tourne avec un dossier de configuration isolé (`CBL_LOG_USER_DATA`) : la configuration réelle n'est pas touchée.
