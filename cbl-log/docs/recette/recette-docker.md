# Recette Docker Desktop cbl-log (issue #393)

Exécutée le 2026-11-02 sur l'application **packagée** (`release/win-unpacked/cbl-log.exe`), version 3.0.0, par `npm run recette` (`scripts/recette/`).

Machine : Intel(R) Core(TM) i5-14600KF (20 threads), 32 Go de RAM, Windows 10.0.26300 win32.
Windows Defender (protection en temps réel) : actif.
Commit mesuré : 2360e43f.
Jeu de test : celui de la recette fichier — mêmes lignes WebSphere générées (`npm run bench`, 128M), même format d'écrivain (`#seq#heure#`), mêmes débits, durées et seuils — mais lues depuis le stdout de conteneurs Docker Desktop (image `node:22-alpine`). Comparaison avec la recette fichier : `docs/recette/comparaison.md`.

| # | Critère | Résultat |
|---|---------|----------|
| D1 | Ouvrir un conteneur (128 Mio de log WebSphere en historique, 5000 dernières lignes) | ✅ PASS |
| D2 | Conteneur : 1 000 lignes/s en continu (20 s, follow) | ✅ PASS |
| D2B | Conteneur bavard : 10 000 lignes/s (NF-04, 10 s, follow) | ❌ FAIL |
| D3 | Rotation du fichier tampon au plafond (1 Mio au lieu de 256 Mo) | ✅ PASS |
| D5 | Conteneur arrêté puis redémarré | ✅ PASS |
| D6 | `docker compose up` qui recrée le conteneur (même nom, nouvel id) | ✅ PASS |
| D4 | 8 conteneurs suivis en même temps (1 000 lignes/s chacun, 20 s) | ✅ PASS |
| D7 | Fermer / rouvrir l'appli, nettoyage des fichiers tampons | ✅ PASS |

## D1 — Ouvrir un conteneur (128 Mio de log WebSphere en historique, 5000 dernières lignes)

Critère : 5 000 dernières lignes affichées en moins de 0,3 s ; format websphere-basic détecté ; « Charger plus d'historique » fonctionne.

| Mesure | Valeur |
|---|---|
| historique du conteneur | 128 Mio de lignes WebSphere (les 1 573 191 premières du même fichier généré que R1) |
| double-clic → premières lignes affichées | 61 ms |
| double-clic → 5 000 lignes indexées et affichées | 72 ms (seuil ≤ 300 ms) |
| lignes dans l'onglet | 5 000 |
| format détecté | WebSphere |
| lignes avec niveau (visibles) | 52 |
| mémoire privée, au repos | 135 Mio (5 processus ; working set 452 Mio) |
| « Charger plus d'historique » (×10) | 5 000 → 50 000 lignes en 993 ms |

> Pas de comparaison directe avec R1 : R1 indexe un fichier de 1 Gio (fin affichée < 1 s), D1 charge uniquement la fin (tail=5000). Ce qui se compare est le délai d'ouverture ressenti, pas la taille.

> Le conteneur vient d'être rempli : les logs sont dans le cache de dockerd (une lecture à froid sera plus lente).

## D2 — Conteneur : 1 000 lignes/s en continu (20 s, follow)

Critère : l'affichage suit en continu, l'UI reste fluide (mêmes seuils que R2).

| Mesure | Valeur |
|---|---|
| dernière ligne affichée | #19999 (attendu #19999) |
| lignes dans l'onglet | 70 000 (attendu 70 000) |
| latence écriture → affichage | p50 79 ms, p95 100 ms, max 339 ms (seuil p95 ≤ 500 ms) |
| durée des images | p99 19.0 ms, 0 images > 100 ms sur 1365 (seuil p99 ≤ 50 ms) |
| CPU pendant l'écriture (% d'un cœur) | moteur 6.2 %, toute l'appli 34.7 % |
| mémoire privée | 216 Mio |
| décalage d'horloge conteneur − hôte (corrigé) | 41 ms |

> La latence passe par dockerd (VM WSL2) → named pipe → spool → tailer : c'est l'écart avec la recette fichier qui est intéressant.

> L'échantillonneur de l'UI lit la dernière ligne toutes les 100 ms : la latence mesurée a une résolution de ~100 ms.

## D2B — Conteneur bavard : 10 000 lignes/s (NF-04, 10 s, follow)

Critère : délai d'affichage ≤ 100 ms (p95) ; CPU du moteur ~2 % d'un cœur ; Defender actif.

| Mesure | Valeur |
|---|---|
| dernière ligne affichée | #99999 (attendu #99999) |
| lignes dans l'onglet | 150 000 (attendu 150 000) |
| latence écriture → affichage | p50 97 ms, p95 134 ms, max 365 ms (seuil p95 ≤ 100 ms) |
| durée des images | p99 19.1 ms, 0 images > 100 ms sur 764 (seuil p99 ≤ 50 ms) |
| CPU pendant l'écriture (% d'un cœur) | moteur 12.0 %, toute l'appli 40.8 % |
| mémoire privée | 238 Mio |
| décalage d'horloge conteneur − hôte (corrigé) | 39 ms |

> La latence passe par dockerd (VM WSL2) → named pipe → spool → tailer : c'est l'écart avec la recette fichier qui est intéressant.

> L'échantillonneur de l'UI lit la dernière ligne toutes les 100 ms : la latence mesurée a une résolution de ~100 ms.

## D3 — Rotation du fichier tampon au plafond (1 Mio au lieu de 256 Mo)

Critère : aucune ligne perdue ni dupliquée, séparateur de rotation affiché à chaque rotation.

| Mesure | Valeur |
|---|---|
| lignes écrites par le conteneur | 117 100 (≈ 14.0 Mio, plafond 1 Mio) |
| lignes comptées par l'onglet | 117 100 (manquantes : 0) |
| lignes encore lisibles (copie de tout l'onglet) | 20 841 |
| doublons / désordre dans les lignes lisibles | 0 / 0 |
| séparateurs de rotation affichés | 17 |

> Comme pour R3, seules les lignes du spool courant et des archives gardées (3) restent lisibles ; les plus anciennes sont comptées mais libérées.

## D5 — Conteneur arrêté puis redémarré

Critère : aucune ligne perdue ni dupliquée.

| Mesure | Valeur |
|---|---|
| lignes avant l'arrêt → après le redémarrage | 5 000 → 10 000 (attendu 10 000) |
| lignes lisibles / perdues / dupliquées / désordre | 10 000 / 0 / 0 / 0 |

## D6 — `docker compose up` qui recrée le conteneur (même nom, nouvel id)

Critère : même onglet, séparateur « conteneur recréé ».

| Mesure | Valeur |
|---|---|
| onglets avant → après | 1 → 1 (même onglet attendu) |
| séparateurs « conteneur recréé » | 1 (attendu 1) |
| lignes comptées | 15 000 (attendu 15 000) |
| lignes lisibles / perdues / dupliquées / désordre | 15 000 / 0 / 0 / 0 |

## D4 — 8 conteneurs suivis en même temps (1 000 lignes/s chacun, 20 s)

Critère : UI fluide, mémoire < 400 Mo (NF-11).

| Mesure | Valeur |
|---|---|
| contenu préexistant | 8 × 20 000 lignes (mêmes premières lignes du fichier généré) |
| lignes écrites par conteneur | 20 000 (160 000 au total) |
| lignes manquantes par onglet | 0, 0, 0, 0, 0, 0, 0, 0 |
| mémoire privée, avant → pendant/après | 190 → 275 Mio (5 processus ; working set 592 Mio) |
| durée des images (onglet actif) | p99 19.0 ms, 0 images > 100 ms sur 1428 (seuil p99 ≤ 50 ms) |
| latence écriture → affichage (onglet actif) | p95 119 ms |
| CPU pendant l'écriture (% d'un cœur) | moteur 63.6 %, toute l'appli 110.8 % |

## D7 — Fermer / rouvrir l'appli, nettoyage des fichiers tampons

Critère : mêmes onglets conteneur ; tampons supprimés à la fermeture d'onglet et purgés au lancement.

| Mesure | Valeur |
|---|---|
| onglets rouverts depuis la session (docker://…) | 2 sur 2 |
| lignes de l'onglet actif | 2000 |
| fichiers tampons présents | 2 |
| après fermeture d'un onglet | 1 fichier tampon restant |
| tampons orphelins avant → après relance | 1 → 0 |

> Dossier des tampons : C:\Users\Clement\AppData\Local\cbl-log\docker\desktop-linux

## Scénarios manuels (à cocher à la main, voir `docs/recette/README.md`, § Scénarios manuels)

- [ ] Docker Desktop arrêté au lancement de cbl-log, puis démarré : connexion automatique, onglets repris
- [ ] Compte hors du groupe `docker-users` : message clair
- [ ] Redémarrage de Docker Desktop pendant le suivi : reconnexion et reprise sans doublon
- [ ] Conteneur WebSphere réel de référence : stack traces repliées, filtres de niveau

## Comment relancer

```bash
cd cbl-log
npm run package:dir                       # construit release/win-unpacked/cbl-log.exe
npm run bench -- --size 1G --generate-only # compile le banc (générateur + écrivain) et prépare le log
npm run recette -- --source both --size 1G --out docs/recette-mvp.md --docker-out docs/recette/recette-docker.md --compare-out docs/recette/comparaison.md --history docs/recette/history.jsonl
npm run recette -- --source docker --only d2b,d4 # une partie seulement
```

Docker Desktop doit tourner. Les conteneurs créés (étiquette `cbl-log-recette`) sont supprimés à la fin ; l'application tourne avec un dossier de configuration isolé (`CBL_LOG_USER_DATA`).
