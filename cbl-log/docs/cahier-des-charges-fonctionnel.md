# cbl-log — Cahier des charges fonctionnel

> Statut : **v0.4 — validé pour démarrer le développement (M0)**.
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
| F-10   | Source = sortie d'une commande (`docker logs -f x`, `kubectl logs -f`, `journalctl -f`) ou stdin       | P2   |
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

## 4. Exigences non fonctionnelles

| ID     | Exigence                                                                                              |
|--------|-------------------------------------------------------------------------------------------------------|
| NF-01  | **Démarrage** : fenêtre affichée < 2 s ; fin d'un fichier de 10 Go visible < 1 s après ouverture        |
| NF-02  | **Mémoire** : < 400 Mo au total (dont ~150 Mo de socle Electron) pour un fichier de 10 Go, indépendant de la taille du contenu |
| NF-03  | **Indexation** : ≥ 300 Mo/s sur SSD local                                                               |
| NF-04  | **Débit temps réel** : absorber 10 000 lignes/s en follow sans figer l'UI (rendu ≤ 60 fps, coalescé)    |
| NF-05  | **Recherche/filtre** : premiers résultats < 1 s, 1 Go filtré en < 3 s, progression visible, annulable  |
| NF-11  | **Multi-logs** : 8 fichiers suivis simultanément (onglets + split), 1 000 lignes/s chacun, totalisant 10 Go, sans dégradation visible de l'UI ni dépassement de NF-02 |
| NF-06  | **Windows 10/11 x64** uniquement ; installeur + version portable (`.exe` sans installation)             |
| NF-07  | Hors ligne, aucune télémétrie, aucune donnée ne quitte la machine. Seule exception : la vérification des mises à jour (lecture des releases GitHub, désactivable via `checkForUpdates`) |
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

## 8. Jalons proposés

| Jalon | Contenu                                                                         |
|-------|---------------------------------------------------------------------------------|
| M0    | Squelette Electron + moteur de lecture/indexation/rolling testé seul (tests + script de bench) |
| M1    | MVP P0 : onglets, follow, rotation, surlignage, recherche, session              |
| M2    | Filtres, format WebSphere + autres parseurs, regroupement multi-lignes, niveaux |
| M3    | **Onglet « Tout » (vue fusionnée)**, aller à l'horodatage                       |
| M4    | Profils, signets, alertes, export, palette de commandes, split view             |
| M5    | JSON, archives du rolling (T-08), minimap                                       |
| M6+   | P2 : sources commande/stdin/SSH, `.gz`, plugins, import BareTail                 |

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

## 10. Questions ouvertes

1. **Format de config** : JSON retenu par défaut (cohérent avec le monorepo), TOML possible plus tard.
2. **Formatage exact des logs WebSphere** : *en partie levée* — un `SystemOut.log` réel a fixé le parseur par défaut
   et la locale (`M/d/yy`, UTC). Reste à fournir : le nom des archives de rolling (détection T-08) et un exemple Liberty
   (`messages.log` / JSON).
