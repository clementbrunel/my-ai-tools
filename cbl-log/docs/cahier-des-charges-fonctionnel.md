# cbl-log — Cahier des charges fonctionnel

> Statut : **v0.5 — à jour de ce qui est développé (v2.1.0 + onglet « Tout » + conteneurs Docker)**. L'avancement par exigence est au § 11.
> v0.5 : conteneurs Docker Desktop (§ 3.9, D-01 à D-10), onglet « Tout » livré (M-01 à M-01e, A-07), historique du rolling chargé avec le fichier (T-08/T-09), recherche et filtre sur tout le flux, recette automatisée fichier + Docker (§ 7, [`recette/`](./recette/README.md)) ; M4 et M5 non planifiés.
> v0.4 : rolling confirmé (même nom + archives à côté), bind mount Windows, format de log fourni plus tard.
> v0.3 : source de référence = WebSphere en conteneur Docker, perf 10 Go conservée (plusieurs logs en parallèle).
> v0.2 : nom `cbl-log`, Windows seul, priorité au fichier `.log` en rolling, pas de version terminal,
> pile TypeScript (Electron) au lieu de Rust.

## 1. Contexte et objectif

[BareTail](https://www.baremetalsoft.com/baretail/) est un visualiseur de logs temps réel pour Windows,
apprécié pour sa simplicité : ouvrir un fichier, le voir défiler en direct, colorer les lignes
selon des mots-clés. Il n'a pas évolué depuis des années et montre ses limites :

| Limite de BareTail                                         | Conséquence                                         |
|------------------------------------------------------------|-----------------------------------------------------|
| UI Win32 datée, pas de thème sombre, pas de HiDPI propre   | Fatigue visuelle, ergonomie d'un autre âge          |
| Highlighting par sous-chaîne, pas de vraie regex (free)    | Règles approximatives, faux positifs                |
| Pas de filtre ni de recherche avancée (réservés à la Pro)  | Impossible d'isoler un flux dans un log verbeux     |
| Aucune compréhension du format (niveau, timestamp, JSON)   | Logs JSON illisibles, pas de saut par horodatage    |
| Un onglet = un fichier, pas de fusion chronologique        | Corréler app + proxy + DB impose de jongler         |
| Pas de session persistée, pas de profils par projet        | On reconfigure tout à chaque ouverture              |
| Pas de signets, pas d'annotation, pas d'export de sélection| Partage d'un incident laborieux                     |
| Pas d'alertes                                              | Il faut garder un œil sur la fenêtre                |

**Objectif** : un outil perso, moderne, **pour Windows**, qui conserve la qualité n°1 de BareTail
(*ouvrir n'importe quel fichier, même énorme, et le suivre instantanément*) — y compris à travers le
**rolling** des fichiers (Logback, Log4j2, Serilog, NLog…) — tout en ajoutant ce qui
manque, et qui soit **facile à customiser** (règles, parseurs, thèmes) puisque c'est la raison
d'être d'un outil maison.

## 2. Utilisateurs et cas d'usage

Utilisateur unique : développeur·se / ops qui lit des logs applicatifs au quotidien
(Spring Boot, Node, nginx, Docker, Home Assistant…), en local ou sur un partage réseau (NAS).

**Source de référence** : un serveur **WebSphere** qui tourne dans un **conteneur Docker** et écrit son
`.log` dans un **bind mount vers un dossier Windows** (`-v C:\logs\…:/…/logs`), lu directement depuis Windows.
Rolling **tous les ~100 Mo** : le fichier courant garde toujours le même nom (BareTail le suit sans
intervention) et des **archives** apparaissent au fur et à mesure dans le même dossier. Que ce soit un
vidage sur place (copy + truncate) ou un renommage suivi d'une recréation, vu de l'extérieur c'est
identique : cbl-log gère les deux et le test de référence couvre les deux.
Plusieurs logs (plusieurs serveurs/conteneurs) peuvent être suivis **en même temps**.

Cas d'usage de référence :

- **UC1 — Suivre un log en direct** pendant un démarrage d'appli ou un test manuel.
- **UC2 — Ouvrir un gros log a posteriori** (plusieurs Go) pour analyser un incident.
- **UC3 — Isoler un flux** : n'afficher que les `ERROR`, ou que les lignes d'un `traceId`.
- **UC4 — Corréler plusieurs fichiers** (app + nginx) dans une vue chronologique unique.
- **UC5 — Retrouver sa config** : rouvrir « le projet prono-core » avec ses fichiers, règles et filtres.
- **UC6 — Être prévenu** quand un motif apparaît (ex. `OutOfMemoryError`) sans regarder l'écran.
- **UC7 — Partager un extrait** : copier/exporter une plage ou une sélection filtrée.

## 3. Périmètre

Priorités : **P0** = MVP (parité BareTail utile), **P1** = V1 (ce qui justifie l'outil), **P2** = plus tard.

### 3.1 Ouverture et lecture de fichiers

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| F-01   | Ouvrir un fichier via dialogue, glisser-déposer, ligne de commande (`cbl-log fichier.log`) et récents | P0   |
| F-02   | Ouvrir des fichiers de **taille arbitraire** (≥ 10 Go) sans les charger en mémoire                     | P0   |
| F-03   | Affichage immédiat de la **fin** du fichier, l'indexation complète se fait en arrière-plan             | P0   |
| F-04   | Lecture **non bloquante** : ne jamais verrouiller le fichier (l'appli qui écrit doit continuer)        | P0   |
| F-05   | Encodages : UTF-8 (défaut), UTF-16 LE/BE (BOM), Latin-1/Windows-1252 ; sélection manuelle possible     | P0   |
| F-06   | Fins de ligne `\n`, `\r\n`, `\r` ; lignes très longues tronquées à l'affichage (seuil configurable)    | P0   |
| F-07   | Fichiers sur partage réseau (SMB/NFS) **et volumes Docker Desktop** (bind mount d'un dossier Windows, ou `\\wsl$\…`) — fonctionnement par polling, les événements FS n'y étant pas fiables | P0 |
| F-08   | Ouvrir un fichier compressé `.gz` en lecture seule (sans suivi temps réel)                             | P2   |
| F-09   | Suivre un **motif de fichiers** (`C:\logs\app-*.log`) et basculer sur le plus récent (rolling par nom daté) | P1 |
| F-10   | Source = sortie d'une commande (`docker logs -f x`, `kubectl logs -f`, `journalctl -f`) ou stdin — **Docker est couvert nativement par D-01 à D-10** | P2   |
| F-11   | Source distante via SSH (tail d'un fichier sur une autre machine)                                      | P2   |

### 3.2 Suivi temps réel

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| T-01   | Les nouvelles lignes apparaissent en < 250 ms après leur écriture (fichier local)                      | P0   |
| T-02   | Mode **Follow** (auto-scroll en bas) activable/désactivable ; se désactive seul si on remonte         | P0   |
| T-03   | Détection de **troncature** (taille qui diminue) → relecture depuis le début, marqueur visuel         | P0   |
| T-04   | Détection de **rolling** : le fichier est renommé (`app.log` → `app.2026-10-14.0.log`) puis recréé → bascule sur le nouveau `app.log` | P0 |
| T-04b  | **Aucune ligne perdue** au rolling : les dernières lignes écrites dans l'ancien fichier sont lues avant la bascule | P0 |
| T-04c  | Ne **jamais bloquer le rolling** de l'appli : sous Windows, un handle ouvert sans partage « delete » fait échouer le renommage (cas classique de Logback qui ne roule plus) | P0 |
| T-04d  | Séparateur visuel « ── rolling 10:02:11 → app.2026-10-14.0.log ── » dans la vue                    | P0   |
| T-05   | Fichier supprimé puis recréé : attente puis reprise, état « en attente » affiché                      | P0   |
| T-06   | Pause du rafraîchissement (figer la vue sans perdre les lignes qui arrivent)                          | P1   |
| T-08   | Accès aux **fichiers précédents** du rolling (liste des archives du même motif, ouverture en un clic, y compris `.gz`) | P1 |
| T-09   | Option « historique continu » : voir l'archive précédente + le fichier courant comme un seul flux | P2 |
| T-07   | Indicateur d'activité par onglet (point / compteur de nouvelles lignes depuis la dernière visite)     | P0   |

### 3.3 Affichage

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| A-01   | **Un onglet par fichier**, réordonnables, avec indicateur d'activité ; vue scindée (split horizontal/vertical) de 2 à 4 fichiers | P0 (onglets) / P1 (split) |
| A-02   | Défilement fluide sur des millions de lignes (liste virtualisée), barre de défilement fidèle          | P0   |
| A-03   | Numéros de ligne, retour à la ligne (wrap) activable, police monospace configurable, zoom             | P0   |
| A-04   | Thèmes clair / sombre / système                                                                        | P0   |
| A-05   | **Minimap** / gouttière montrant la position des lignes surlignées et des résultats de recherche      | P1   |
| A-06   | Aller à la ligne N, aller au début / à la fin                                                          | P0   |
| A-07   | Aller à un **horodatage** (si le format est reconnu)                                                    | P1   |
| A-08   | Lignes multi-lignes (stack traces) regroupées et repliables sous la ligne qui les précède              | P1   |
| A-09   | Affichage JSON : une ligne JSON est rendue en colonnes choisies (`ts`, `level`, `msg`) + détail dépliable | P1 |
| A-10   | Vue en colonnes pour les formats structurés (timestamp, niveau, logger, message)                       | P2   |

### 3.4 Surlignage (highlighting)

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| H-01   | Règles ordonnées : motif (texte ou **regex**), sensibilité à la casse, couleur texte + fond            | P0   |
| H-02   | Portée : **ligne entière** ou **seulement le fragment** correspondant                                  | P0   |
| H-03   | Règles par défaut fournies (`ERROR`, `WARN`, `INFO`, `DEBUG`, `Exception`, `Caused by`)                | P0   |
| H-04   | Jeux de règles nommés, réutilisables, attachables à un profil (cf. § 3.7)                              | P1   |
| H-05   | Activer/désactiver une règle à la volée sans l'effacer                                                  | P0   |
| H-06   | Surlignage temporaire « tout ce qui ressemble à la sélection » (double-clic sur un mot)                | P1   |
| H-07   | Import des règles depuis un fichier de config BareTail (`.udm` / registre) pour migrer                  | P2   |
| H-08   | **Export / import** d'un profil de surlignage (fichier `.json`) pour le partager entre collègues ; à l'import, un profil de même id est remplacé ou gardé en copie au choix | P1   |

### 3.5 Recherche et filtrage

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| S-01   | Recherche texte / regex, suivant / précédent, compteur de résultats, sans bloquer l'UI                 | P0   |
| S-02   | **Filtre** : n'afficher que les lignes qui matchent (include) ou masquer celles qui matchent (exclude) | P1   |
| S-03   | Filtres combinables (ET / OU), filtre par **niveau** (cases ERROR/WARN/INFO/DEBUG)                     | P1   |
| S-04   | Le filtre s'applique aussi aux lignes qui arrivent en temps réel                                       | P1   |
| S-05   | Basculer filtré ↔ complet en conservant la position (« montrer le contexte autour de cette ligne »)    | P1   |
| S-06   | Contexte : afficher N lignes avant/après chaque résultat (comme `grep -C`)                             | P2   |
| S-07   | Historique des recherches/filtres récents                                                              | P1   |
| S-08   | Filtre par plage horaire (de… à…)                                                                      | P2   |

### 3.6 Multi-fichiers

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| M-01   | **Onglet « Tout »** (épinglé en premier) : vue centralisée de tous les fichiers ouverts (ou d'une sélection), entrelacés par horodatage, en temps réel | P1 |
| M-01b  | Dans la vue fusionnée, chaque ligne porte l'**étiquette et la couleur de sa source** (ex. `srv1`, `srv2`), avec cases pour masquer/afficher une source | P1 |
| M-01c  | Depuis la vue fusionnée, « ouvrir dans l'onglet du fichier » saute à la même ligne dans son onglet (et inversement) | P1 |
| M-01d  | Filtres, surlignage, recherche et alertes fonctionnent à l'identique dans la vue fusionnée               | P1   |
| M-01e  | Les rollings de chaque source apparaissent dans la vue fusionnée comme des séparateurs étiquetés         | P1   |
| M-02   | Rechercher dans tous les onglets ouverts                                                                | P2   |

### 3.7 Sessions, profils, personnalisation

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| C-01   | Restauration de la session à la réouverture (onglets, position, follow, filtres actifs)                | P0   |
| C-02   | **Profils** nommés : ensemble de fichiers/motifs + jeu de règles + parseur + filtres (« prono-core dev ») | P1 |
| C-03   | Configuration stockée en **fichiers texte lisibles** (JSON/TOML) éditables à la main et versionnables  | P0   |
| C-04   | **Parseurs de format** déclaratifs (regex à groupes nommés : `ts`, `level`, `logger`, `msg`) ; formats fournis : **WebSphere traditional** (`SystemOut.log`), **WebSphere Liberty** (`messages.log`, et JSON logging), Spring Boot/Logback, JSON lines | **P0** pour WebSphere, P1 pour les autres |
| C-05   | Raccourcis clavier configurables ; palette de commandes (`Ctrl+Shift+P`)                               | P1   |
| C-06   | Point d'extension pour scripts/plugins utilisateur (transformation ou action sur ligne)                 | P2   |

### 3.8 Signets, export, alertes

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| B-01   | Copier la sélection (avec ou sans numéros de ligne)                                                     | P0   |
| B-02   | **Signets** sur des lignes, navigation entre signets, note facultative ; persistés par fichier          | P1   |
| B-03   | Exporter la vue courante (filtrée) ou une plage vers un fichier                                         | P1   |
| B-04   | **Alertes** : règle → notification système (+ son facultatif), avec anti-rafale (1 notif / N s)       | P1   |
| B-05   | Effacer la vue (« clear ») : masquer tout ce qui précède, comme un `clear` de terminal                  | P0   |

### 3.9 Conteneurs Docker (Docker Desktop)

Lire les logs (stdout/stderr) des conteneurs de Docker Desktop directement depuis cbl-log, sans bind mount ni
configuration, avec toutes les fonctions existantes (recherche, filtres, niveaux, surlignage, repli des stack traces,
onglet « Tout »). Conception : [architecture § 4.8](./architecture.md).

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| D-01   | **Panneau Docker** (`Ctrl+Maj+D`) : conteneurs groupés par projet compose, pastille d'état, filtre texte, mise à jour en direct, ouverture par double-clic ou multi-sélection | P1 |
| D-02   | **Un onglet par conteneur** (icône baleine + nom), identifié par son **nom** ; logs stdout/stderr en suivi temps réel, mêmes fonctions qu'un fichier | P1 |
| D-03   | Connexion **sans configuration** au démon (named pipe de Docker Desktop, endpoint résolu comme la CLI : réglage, `DOCKER_HOST`, contexte courant) ; messages clairs (Docker non lancé, compte hors `docker-users`, version trop ancienne) ; reconnexion automatique | P1 |
| D-04   | **Lecture seule stricte** : le client n'envoie que des `GET` sur une liste blanche de routes (NF-08 étendu) | P1 |
| D-05   | Ouverture sur les **N dernières lignes** (5 000 par défaut) en < 0,3 s ; « Charger plus d'historique » (×10) en gardant la position | P1 |
| D-06   | Conteneur arrêté puis redémarré : **aucune ligne perdue ni dupliquée** ; conteneur **recréé** (`docker compose up`) : même onglet, séparateur « conteneur recréé » | P1 |
| D-07   | Session et fichiers récents retiennent `docker://<contexte>/<nom>` et se raccrochent au conteneur du même nom | P1 |
| D-08   | Copie locale des logs (fichier tampon) plafonnée (256 Mo, rotation), supprimée à la fermeture de l'onglet, purgée au lancement si orpheline | P1 |
| D-09   | Débit : un conteneur à **10 000 lignes/s** coûte ~2 % d'un cœur au moteur et s'affiche en ≤ 100 ms, **Defender actif** ; **8 conteneurs** suivis ensemble (NF-04, NF-11) | P1 |
| D-10   | Un conteneur sans log lisible (`log-driver: none`) est grisé avec l'explication | P1 |

Hors périmètre : stats CPU/mémoire, shell, démarrer/arrêter un conteneur (cbl-log reste en lecture seule) ; Docker du NAS
(reporté, accessible en SSH seulement) ; Docker Engine dans une distro WSL sans Docker Desktop.

## 4. Exigences non fonctionnelles

| ID     | Exigence                                                                                              |
|--------|-------------------------------------------------------------------------------------------------------|
| NF-01  | **Démarrage** : fenêtre affichée < 2 s ; fin d'un fichier de 10 Go visible < 1 s après ouverture        |
| NF-02  | **Mémoire** : < 400 Mo au total (dont ~150 Mo de socle Electron) pour un fichier de 10 Go, indépendant de la taille du contenu |
| NF-03  | **Indexation** : ≥ 300 Mo/s sur SSD local                                                               |
| NF-04  | **Débit temps réel** : absorber 10 000 lignes/s en follow sans figer l'UI (rendu ≤ 60 fps, coalescé), pour un fichier comme pour un conteneur Docker (D-09) |
| NF-05  | **Recherche/filtre** : premiers résultats < 1 s, 1 Go filtré en < 3 s, progression visible, annulable  |
| NF-11  | **Multi-logs** : 8 fichiers suivis simultanément (onglets + split), 1 000 lignes/s chacun, totalisant 10 Go, sans dégradation visible de l'UI ni dépassement de NF-02 |
| NF-06  | **Windows 10/11 x64** uniquement ; installeur + version portable (`.exe` sans installation)             |
| NF-07  | Hors ligne, aucune télémétrie, aucune donnée ne quitte la machine. Seule exception : la vérification des mises à jour (lecture des releases GitHub, désactivable via `checkForUpdates`). Le signalement de bug (Aide) n'envoie rien : il ouvre une issue pré-remplie dans le navigateur |
| NF-08  | Lecture seule stricte sur les fichiers suivis : l'outil n'écrit jamais dans un log                      |
| NF-09  | Robustesse : un fichier binaire, illisible ou supprimé ne fait jamais planter l'appli                   |
| NF-10  | Accessibilité de base : navigation clavier complète, contrastes suffisants des thèmes par défaut        |

## 5. Hors périmètre

- Agrégation centralisée de logs (ce n'est ni un ELK ni un Loki) ; pas de serveur, pas de base de données.
- Édition des fichiers de log.
- Requêtage type SQL/LogQL (éventuellement P2+ si le besoin émerge).
- Multi-utilisateur, partage en ligne.

## 6. Interface — esquisse

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ☰  [app.log ●12] [nginx/access.log] [merge: app+nginx] [+]        ⌕  ⚙  ◐    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Filtre: [level ≥ WARN] [traceId=ab12 ×]  [+ include] [+ exclude]   1 204 / 3,2 M│
├────┬─────────────────────────────────────────────────────────────────────┬───┤
│1201│ 2026-10-14 10:02:11.204  INFO  c.p.Api   GET /bets 200 12ms         │ ▒ │
│1202│ 2026-10-14 10:02:11.390  WARN  c.p.Pool  pool 90% used              │ ▒ │← minimap
│1203│ 2026-10-14 10:02:12.007  ERROR c.p.Db    Connection refused      ▸  │ █ │
│    │   ▸ 34 lignes de stack trace                                        │   │
│1238│ 2026-10-14 10:02:12.010  INFO  c.p.Api   retry 1/3                  │ ▒ │
├────┴─────────────────────────────────────────────────────────────────────┴───┤
│ UTF-8 · LF · 2,4 Go · indexé 100 % · ⏵ FOLLOW · Spring Boot · règles: défaut │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 7. Critères d'acceptation du MVP (P0)

1. Ouvrir un fichier de 10 Go généré : la fin s'affiche en < 1 s, mémoire totale < 400 Mo.
2. Un script qui écrit 1 000 lignes/s : l'affichage suit en continu, l'UI reste fluide.
3. Un conteneur WebSphere Liberty (ou un écrivain simulé) qui roule toutes les 1 Mo, en **truncate** puis en
   **rename + create**, suivi pendant 10 rollings : **le rolling réussit à chaque fois** côté serveur,
   aucune ligne dupliquée côté cbl-log, aucune ligne perdue en rename, séparateur affiché.
3b. Le fichier est vidé puis **regrossit au-delà de l'ancienne taille entre deux contrôles** : la
   troncature est quand même détectée (pas de lignes mélangées).
4. Pendant le suivi sous Windows, l'appli qui écrit peut renommer/supprimer le fichier (pas de verrou).
5. Fichier dans un volume Docker Desktop et sur un partage SMB du NAS : les nouvelles lignes apparaissent (polling).
8. 8 onglets en follow simultané (NF-11) : UI fluide, mémoire < 400 Mo.
6. Règles de surlignage regex appliquées, modifiables à chaud, persistées.
7. Fermer / rouvrir l'appli : mêmes onglets, mêmes positions, mêmes règles.

Critères ajoutés en v0.5 (recette : [`recette/README.md`](./recette/README.md), issue #393) :

9. **Docker** (D1 à D7 de la recette) : ouverture d'un conteneur sur ses 5 000 dernières lignes en < 0,3 s ; conteneur arrêté
   puis redémarré sans perte ni doublon ; conteneur recréé dans le même onglet avec séparateur ; conteneur à 10 000 lignes/s
   (CPU du moteur ~2 % d'un cœur, délai ≤ 100 ms, Defender actif) ; 8 conteneurs suivis ; rotation du tampon ; tampons
   nettoyés. Même jeu de données que les critères 1 à 8 pour comparer fichier et Docker.
10. **Onglet « Tout »** (M1 à M4 de la recette) : première page < 1 s, fusion complète de 2 puis 4 fichiers de 200 Mo à 1 Go
    en quelques secondes sans gêner les autres onglets, 8 sources en follow (délai ≈ 2,25 s), recherche et filtre
    (comparés à NF-05) ; décision sur le passage de la fusion dans les workers.
11. **Scénarios manuels** : Docker Desktop arrêté puis lancé, compte hors `docker-users`, conteneur WebSphere réel,
    redémarrage de Docker Desktop pendant le suivi.

## 8. Jalons proposés

| Jalon | Contenu                                                                         | État |
|-------|---------------------------------------------------------------------------------|------|
| M0    | Squelette Electron + moteur de lecture/indexation/rolling testé seul (tests + script de bench) | ✅ livré |
| M1    | MVP P0 : onglets, follow, rotation, surlignage, recherche, session              | ✅ livré |
| M2    | Filtres, format WebSphere + autres parseurs, regroupement multi-lignes, niveaux | ✅ livré (filtres, niveaux, repli, pause, WebSphere + Spring Boot ; reste : autres formats, F-09, S-07) |
| M3    | **Onglet « Tout » (vue fusionnée)**, aller à l'horodatage                       | ✅ livré (#504 à #510) |
| Docker | Conteneurs Docker Desktop (§ 3.9)                                              | ✅ livré (#483 à #485) ; recette à exécuter dans #393 |
| M4    | Profils, signets, alertes, export, palette de commandes, split view             | ⏸ non planifié (issue #396 fermée) |
| M5    | JSON, archives du rolling (T-08), minimap                                       | ⏸ non planifié (#397 fermée) ; T-08/T-09 livrés autrement (archives chargées avec le fichier) |
| M6+   | P2 : sources commande/stdin/SSH, `.gz`, plugins, import BareTail                 | ⏸ non planifié |

## 9. Décisions prises (v0.4)

| Sujet               | Décision                                                                     |
|---------------------|------------------------------------------------------------------------------|
| Nom                 | `cbl-log`                                                                    |
| OS                  | Windows 10/11 uniquement                                                     |
| Source prioritaire  | `.log` WebSphere écrit par un conteneur Docker dans un volume, **avec rolling ~100 Mo** ; commandes/SSH restent P2 |
| Montage Docker      | Bind mount vers un dossier Windows (événements NTFS disponibles + polling en filet) |
| Format de log       | Format WebSphere exact fourni plus tard ; d'ici là, format « brut » + parseur WebSphere « basic » générique |
| Perf                | Objectifs 10 Go conservés (plusieurs logs ouverts en même temps) + NF-11     |
| Version terminal    | Non                                                                          |
| Pile                | TypeScript de bout en bout (Electron + React) — cf. architecture § 2         |
| Conteneurs Docker   | API du démon via le named pipe de Docker Desktop (client GET-only maison, pas de `dockerode`), copie du flux dans un fichier tampon ouvert comme un log ; un onglet par nom de conteneur ; N dernières lignes (5 000) ; Docker du NAS reporté — cf. architecture § 4.8 |
| Onglet « Tout »     | Fusion par horodatage dans le processus moteur (fenêtre de 2 s) ; passage dans les workers décidé d'après la recette (M1 à M4) |
| Recette             | Automatisée sur l'appli packagée (`npm run recette`) : fichier, Docker, « Tout » ; historique et comparaison fichier ↔ Docker — cf. `recette/README.md` |

## 10. Questions ouvertes

1. **Format de config** : JSON retenu par défaut (cohérent avec le monorepo), TOML possible plus tard.
2. **Formatage exact des logs WebSphere** : *en partie levée* — un `SystemOut.log` réel a fixé le parseur par défaut
   et la locale (`M/d/yy`, UTC) ; les archives de rolling s'appellent `SystemOut_yy.MM.dd_HH.mm.ss.log` (reconnues
   par T-08, autres noms appris d'un exemple). Reste à fournir : un exemple Liberty (`messages.log` / JSON).
3. **Docker Desktop** : *levée* — sur le conteneur WebSphere de référence, tout (`SystemOut` compris) part sur le stdout du
   conteneur, l'API `logs` suffit (architecture § 4.8). À valider par les scénarios manuels de la recette.

## 11. Avancement par exigence (au 2026-11-01)

Établi d'après le code de `main` et les issues fermées. ✅ livré · 🟡 partiel · ⏸ non fait (non planifié).

| Domaine | ✅ Livré | 🟡 Partiel | ⏸ Non fait |
|---|---|---|---|
| Ouverture (§ 3.1) | F-01 (dialogue, glisser-déposer, ligne de commande, récents), F-02, F-03, F-04, F-05, F-07 | F-06 (fins de ligne ; troncature des lignes très longues non vérifiée) | F-08 (`.gz` : `GzSource` non écrite), F-09 (motif de fichiers), F-10 (hors Docker), F-11 |
| Suivi (§ 3.2) | T-01 à T-05, T-04b/c/d, T-06, T-07, T-08 et T-09 (archives chargées avec le fichier, `historyHours`) | | |
| Affichage (§ 3.3) | A-02, A-03 (numéros de ligne), A-04, A-06, A-07 (`Ctrl+G` ligne ou heure), A-08 (repli des stack traces) | A-01 (onglets renommables ; ni réordonnables ni split), A-03 (retour à la ligne / zoom non vérifiés) | A-05 (minimap), A-09, A-10 |
| Surlignage (§ 3.4) | H-01, H-02, H-03, H-04, H-05, H-08 (export / import de profil) | | H-06, H-07 |
| Recherche / filtre (§ 3.5) | S-01, S-02, S-03, S-04, S-05 (sur tout le flux, archives comprises) | | S-06, S-07, S-08 |
| Multi-fichiers (§ 3.6) | M-01, M-01b, M-01c, M-01d, M-01e | | M-02 |
| Sessions (§ 3.7) | C-01, C-03, C-04 (WebSphere basic, Spring Boot) | C-04 (Liberty, JSON lines, Log4j2 manquent) | C-02, C-05, C-06 |
| Signets / export / alertes (§ 3.8) | B-01, B-05 | | B-02, B-03, B-04 |
| Docker (§ 3.9) | D-01 à D-10 | | |
| Hors cahier, livré | mise à jour intégrée (GitHub releases), signalement de bug pré-rempli, installeur NSIS + portable, icône / écran de démarrage / À propos | | |
| Non fonctionnel (§ 4) | NF-06, NF-07, NF-08 (à mesurer : NF-01 à NF-05, NF-11 par la recette #393 / #486) | | |

Lecture : les jalons **M4** et **M5** (profils, signets, alertes, export, palette, split view, JSON, minimap) n'ont pas de
suite planifiée ; leurs issues #396 et #397 sont fermées « non planifié ». L'issue #394 (M2) est fermée alors que F-09, S-07 et
les formats Log4j2 / Liberty JSON qu'elle citait ne sont pas faits.
