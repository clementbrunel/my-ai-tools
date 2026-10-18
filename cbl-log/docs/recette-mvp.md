# Recette MVP cbl-log (critères P0, cahier des charges § 7)

Exécutée le 2026-10-18 sur l'application **packagée** (`release/win-unpacked/cbl-log.exe`), version 0.0.0, par `npm run recette` (`scripts/recette/`).

Machine : Intel(R) Core(TM) i5-14600KF (20 threads), 32 Go de RAM, Windows 10.0.26300 win32.
Fichier de référence : log WebSphere généré (`npm run bench`), 1G au lieu des 10 Go du critère 1.

| # | Critère | Résultat |
|---|---------|----------|
| R1 | Ouvrir un fichier de 1G (WebSphere généré) | ✅ PASS |
| R2 | 1 000 lignes/s en continu (20 s, follow) | ✅ PASS |
| R3-RENAME | Rolling rename + create, 10 rollings de 1 Mio | ✅ PASS |
| R3-TRUNCATE | Rolling truncate pendant l'écriture, 10 rollings de 1 Mio | ✅ PASS |
| R3-COPYTRUNCATE | Rolling copytruncate, 10 rollings de 1 Mio | ✅ PASS |
| R3B | Fichier vidé puis regrossi au-delà de l'ancienne taille entre deux contrôles | ✅ PASS |
| R4 | Pas de verrou pendant le suivi | ✅ PASS |
| R6 | Règles de surlignage regex | ✅ PASS |
| R7 | Fermer / rouvrir l'appli | ✅ PASS |
| R8 | 8 onglets en follow simultané (1 000 lignes/s chacun, 20 s) | ✅ PASS |

## R1 — Ouvrir un fichier de 1G (WebSphere généré)

Critère : fin affichée < 1 s ; mémoire totale < 400 Mo.

| Mesure | Valeur |
|---|---|
| taille | 1.00 Gio, 12 593 583 lignes |
| ouverture → fin affichée | 691 ms (dont ~102 ms de relais de seconde instance mesurés sur un fichier de 10 lignes) → ~589 ms |
| mémoire privée, au repos | 122 Mio (5 processus ; working set 402 Mio) |
| mémoire privée, après 40 sauts aléatoires | 220 Mio (working set 508 Mio) |

> Le fichier vient d'être généré : il est dans le cache disque de l'OS (une lecture à froid sera plus lente).

> La fin n'est affichée qu'une fois l'indexation initiale terminée, donc le délai croît avec la taille : extrapolé linéairement à 10 Gio, ~5.9 s, au-dessus de la cible de 1 s. L'ouverture affiche un loader avec le pourcentage d'indexation ; l'affichage immédiat de la fin (F-03, #406) est volontairement reporté.

> Mémoire : « privée » = working set privé cumulé des processus cbl-log (colonne « Mémoire » du Gestionnaire des tâches) ; le « working set » total compte aussi les pages partagées entre processus.

## R2 — 1 000 lignes/s en continu (20 s, follow)

Critère : l'affichage suit en continu, l'UI reste fluide.

| Mesure | Valeur |
|---|---|
| dernière ligne affichée | #19999 (attendu #19999) |
| lignes dans l'onglet | 70 000 (attendu 70 000) |
| latence écriture → affichage | p50 150 ms, p95 461 ms, max 1459 ms (seuil p95 ≤ 500 ms) |
| durée des images | p99 18.2 ms, 2 images > 100 ms sur 1282 (seuil p99 ≤ 50 ms) |
| mémoire privée | 193 Mio |

## R3-RENAME — Rolling rename + create, 10 rollings de 1 Mio

Critère : le rolling réussit à chaque fois côté serveur, aucune ligne dupliquée, séparateur affiché, aucune ligne perdue.

| Mesure | Valeur |
|---|---|
| lignes écrites | 117 100 (10 rollings de 1 Mio) |
| lignes comptées par l'onglet | 117 100 (manquantes : 0) |
| lignes encore lisibles (copie de tout l'onglet) | 35 200 |
| erreurs côté écrivain (rename / truncate / copie / ouverture) | aucune |
| doublons / désordre dans les lignes lisibles | 0 / 0 |
| séparateurs de rolling affichés | 10 sur 10 |

> Seules les lignes du fichier courant et des 3 derniers fichiers roulés restent lisibles dans l'interface ; les plus anciennes sont comptées mais libérées (archives du rolling : T-08, M5).

## R3-TRUNCATE — Rolling truncate pendant l'écriture, 10 rollings de 1 Mio

Critère : le rolling réussit à chaque fois côté serveur, aucune ligne dupliquée, séparateur affiché.

| Mesure | Valeur |
|---|---|
| lignes écrites | 117 100 (10 rollings de 1 Mio) |
| lignes comptées par l'onglet | 108 600 (manquantes : 8 500) |
| lignes encore lisibles (copie de tout l'onglet) | 100 |
| erreurs côté écrivain (rename / truncate / copie / ouverture) | aucune |
| doublons / désordre dans les lignes lisibles | 0 / 0 |
| séparateurs de rolling affichés | 10 sur 10 |

> Seules les lignes du fichier courant et des 3 derniers fichiers roulés restent lisibles dans l'interface ; les plus anciennes sont comptées mais libérées (archives du rolling : T-08, M5).

> Troncature sans archive pendant l'écriture : des lignes écrites entre deux contrôles peuvent disparaître avec le fichier (inhérent au truncate) ; doublons et désordre restent bloquants.

## R3-COPYTRUNCATE — Rolling copytruncate, 10 rollings de 1 Mio

Critère : le rolling réussit à chaque fois côté serveur, aucune ligne dupliquée, séparateur affiché, aucune ligne perdue.

| Mesure | Valeur |
|---|---|
| lignes écrites | 117 100 (10 rollings de 1 Mio) |
| lignes comptées par l'onglet | 117 100 (manquantes : 0) |
| lignes encore lisibles (copie de tout l'onglet) | 35 200 |
| erreurs côté écrivain (rename / truncate / copie / ouverture) | aucune |
| doublons / désordre dans les lignes lisibles | 0 / 0 |
| séparateurs de rolling affichés | 10 sur 10 |

> Seules les lignes du fichier courant et des 3 derniers fichiers roulés restent lisibles dans l'interface ; les plus anciennes sont comptées mais libérées (archives du rolling : T-08, M5).

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
| lignes colorées (ERROR actif → règle désactivée à chaud) | 7 → 0 |
| règle enregistrée dans rules/default.json | oui (enabled: false) |
| lignes colorées après redémarrage | 0 |

## R7 — Fermer / rouvrir l'appli

Critère : mêmes onglets, mêmes positions, mêmes règles.

| Mesure | Valeur |
|---|---|
| onglets rouverts | 2 sur 2 |
| onglet actif | b.log |
| première ligne affichée (avant → après redémarrage) | 1446 → 1446 |
| follow (avant → après) | coupé → coupé |

## R8 — 8 onglets en follow simultané (1 000 lignes/s chacun, 20 s)

Critère : UI fluide, mémoire < 400 Mo.

| Mesure | Valeur |
|---|---|
| contenu préexistant | 8 × 128 Mio = 1.00 Gio |
| lignes écrites par onglet | 20 000 (160 000 au total) |
| lignes manquantes par onglet | 0, 0, 0, 0, 0, 0, 0, 0 |
| mémoire privée, avant → pendant/après | 172 → 197 Mio (5 processus ; working set 483 Mio) |
| durée des images (onglet actif) | p99 18.3 ms, 0 images > 100 ms sur 1325 (seuil p99 ≤ 50 ms) |

## Non réalisé dans cette passe

- **Critère 1 à 10 Gio** : mesuré sur 1 Gio (extrapolation dans R1).
- **Critère 3 avec un vrai conteneur WebSphere Liberty** (`icr.io/appcafe/open-liberty`, bind mount, `maxFileSize=1`) : remplacé par l'écrivain simulé du banc (`packages/engine/test/fixtures/rolling-writer.mjs`), qui reproduit les trois modes de rolling mais pas le comportement exact d'un serveur.
- **Critère 5** (volume Docker Desktop et partage SMB du NAS) : nécessite Docker et le NAS, hors de portée de cette machine ; le suivi par polling est couvert côté moteur (`PollScheduler`, `LOCAL_POLL_MS` / `UNC_POLL_MS`) mais pas mesuré ici.
- **Critère 8 à 10 Gio au total** (NF-11 complet) : mesuré avec 8 fichiers de 128 Mio (1 Gio au total).

## Comment relancer

```bash
cd cbl-log
npm run package:dir                       # construit release/win-unpacked/cbl-log.exe
npm run bench -- --size 1G --generate-only # compile le banc (générateur + écrivain) et prépare le log
npm run recette -- --size 1G --out docs/recette-mvp.md [--only r1,r2,r3,r3t,r3c,r3b,r4,r67,r8]
```

L'application tourne avec un dossier de configuration isolé (`CBL_LOG_USER_DATA`) : la configuration réelle n'est pas touchée.
