# log-tail — Cahier des charges fonctionnel

> Statut : **brouillon v0.1** — à valider avant tout développement.
> Nom de code provisoire : `log-tail` (à confirmer, cf. § 9).

## 1. Contexte et objectif

[BareTail](https://www.baremetalsoft.com/baretail/) est un visualiseur de logs temps réel pour Windows,
apprécié pour sa simplicité : ouvrir un fichier, le voir défiler en direct, colorer les lignes
selon des mots-clés. Il n'a pas évolué depuis des années et montre ses limites :

| Limite de BareTail                                         | Conséquence                                         |
|------------------------------------------------------------|-----------------------------------------------------|
| Windows uniquement, UI Win32 datée, pas de thème sombre    | Inutilisable sur Linux/macOS, fatigue visuelle      |
| Highlighting par sous-chaîne, pas de vraie regex (free)    | Règles approximatives, faux positifs                |
| Pas de filtre ni de recherche avancée (réservés à la Pro)  | Impossible d'isoler un flux dans un log verbeux     |
| Aucune compréhension du format (niveau, timestamp, JSON)   | Logs JSON illisibles, pas de saut par horodatage    |
| Un onglet = un fichier, pas de fusion chronologique        | Corréler app + proxy + DB impose de jongler         |
| Pas de session persistée, pas de profils par projet        | On reconfigure tout à chaque ouverture              |
| Pas de signets, pas d'annotation, pas d'export de sélection| Partage d'un incident laborieux                     |
| Pas d'alertes                                              | Il faut garder un œil sur la fenêtre                |

**Objectif** : un outil perso, moderne, multiplateforme, qui conserve la qualité n°1 de BareTail
(*ouvrir n'importe quel fichier, même énorme, et le suivre instantanément*) tout en ajoutant ce qui
manque, et qui soit **facile à customiser** (règles, parseurs, thèmes) puisque c'est la raison
d'être d'un outil maison.

## 2. Utilisateurs et cas d'usage

Utilisateur unique : développeur·se / ops qui lit des logs applicatifs au quotidien
(Spring Boot, Node, nginx, Docker, Home Assistant…), en local ou sur un partage réseau (NAS).

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
| F-01   | Ouvrir un fichier via dialogue, glisser-déposer, ligne de commande (`log-tail fichier.log`) et récents | P0   |
| F-02   | Ouvrir des fichiers de **taille arbitraire** (≥ 10 Go) sans les charger en mémoire                     | P0   |
| F-03   | Affichage immédiat de la **fin** du fichier, l'indexation complète se fait en arrière-plan             | P0   |
| F-04   | Lecture **non bloquante** : ne jamais verrouiller le fichier (l'appli qui écrit doit continuer)        | P0   |
| F-05   | Encodages : UTF-8 (défaut), UTF-16 LE/BE (BOM), Latin-1/Windows-1252 ; sélection manuelle possible     | P0   |
| F-06   | Fins de ligne `\n`, `\r\n`, `\r` ; lignes très longues tronquées à l'affichage (seuil configurable)    | P0   |
| F-07   | Fichiers sur partage réseau (SMB/NFS) — fonctionnement par polling si les événements FS sont absents   | P0   |
| F-08   | Ouvrir un fichier compressé `.gz` en lecture seule (sans suivi temps réel)                             | P2   |
| F-09   | Suivre un **motif de fichiers** (`/var/log/app-*.log`) et basculer sur le plus récent                  | P1   |
| F-10   | Source = sortie d'une commande (`docker logs -f x`, `kubectl logs -f`, `journalctl -f`) ou stdin       | P2   |
| F-11   | Source distante via SSH (tail d'un fichier sur une autre machine)                                      | P2   |

### 3.2 Suivi temps réel

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| T-01   | Les nouvelles lignes apparaissent en < 250 ms après leur écriture (fichier local)                      | P0   |
| T-02   | Mode **Follow** (auto-scroll en bas) activable/désactivable ; se désactive seul si on remonte         | P0   |
| T-03   | Détection de **troncature** (taille qui diminue) → relecture depuis le début, marqueur visuel         | P0   |
| T-04   | Détection de **rotation** (fichier remplacé, inode/ID changé) → bascule sur le nouveau fichier        | P0   |
| T-05   | Fichier supprimé puis recréé : attente puis reprise, état « en attente » affiché                      | P0   |
| T-06   | Pause du rafraîchissement (figer la vue sans perdre les lignes qui arrivent)                          | P1   |
| T-07   | Indicateur d'activité par onglet (point / compteur de nouvelles lignes depuis la dernière visite)     | P0   |

### 3.3 Affichage

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| A-01   | **Onglets** multiples, réordonnables ; vue scindée (split horizontal/vertical) de 2 à 4 fichiers      | P0 (onglets) / P1 (split) |
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
| M-01   | **Vue fusionnée** : plusieurs fichiers entrelacés par horodatage, chaque source avec sa couleur/étiquette | P1 |
| M-02   | Rechercher dans tous les onglets ouverts                                                                | P2   |

### 3.7 Sessions, profils, personnalisation

| ID     | Exigence                                                                                              | Prio |
|--------|-------------------------------------------------------------------------------------------------------|------|
| C-01   | Restauration de la session à la réouverture (onglets, position, follow, filtres actifs)                | P0   |
| C-02   | **Profils** nommés : ensemble de fichiers/motifs + jeu de règles + parseur + filtres (« prono-core dev ») | P1 |
| C-03   | Configuration stockée en **fichiers texte lisibles** (JSON/TOML) éditables à la main et versionnables  | P0   |
| C-04   | **Parseurs de format** déclaratifs (regex à groupes nommés : `ts`, `level`, `logger`, `msg`) ; formats fournis : Spring Boot/Logback, nginx access/error, JSON lines, syslog | P1 |
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
| NF-01  | **Démarrage** : fenêtre affichée < 1 s ; fin d'un fichier de 10 Go visible < 1 s                        |
| NF-02  | **Mémoire** : < 200 Mo pour un fichier de 10 Go (index compris), indépendant de la taille du contenu    |
| NF-03  | **Indexation** : ≥ 500 Mo/s sur SSD local (débit disque comme borne)                                    |
| NF-04  | **Débit temps réel** : absorber 10 000 lignes/s en follow sans figer l'UI (rendu ≤ 60 fps, coalescé)    |
| NF-05  | **Recherche/filtre** sur 10 Go : premiers résultats < 1 s, progression visible, annulable              |
| NF-06  | Multiplateforme : **Windows 10+** (cible n°1), Linux, macOS ; binaire unique < 20 Mo                    |
| NF-07  | Hors ligne, aucune télémétrie, aucune donnée ne quitte la machine                                       |
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

1. Ouvrir un fichier de 10 Go généré : la fin s'affiche en < 1 s, mémoire < 200 Mo.
2. Un script qui écrit 1 000 lignes/s : l'affichage suit en continu, l'UI reste fluide.
3. `logrotate` (copytruncate **et** create) pendant le suivi : aucune ligne perdue côté nouveau fichier, marqueur affiché.
4. Pendant le suivi sous Windows, l'appli qui écrit peut renommer/supprimer le fichier (pas de verrou).
5. Fichier sur un partage SMB du NAS : les nouvelles lignes apparaissent (polling).
6. Règles de surlignage regex appliquées, modifiables à chaud, persistées.
7. Fermer / rouvrir l'appli : mêmes onglets, mêmes positions, mêmes règles.

## 8. Jalons proposés

| Jalon | Contenu                                                                         |
|-------|---------------------------------------------------------------------------------|
| M0    | Squelette + moteur de lecture/indexation testé seul (CLI de bench)              |
| M1    | MVP P0 : onglets, follow, rotation, surlignage, recherche, session              |
| M2    | Filtres, parseurs de format, regroupement multi-lignes, niveaux                 |
| M3    | Profils, signets, alertes, export, palette de commandes, split view             |
| M4    | Vue fusionnée multi-fichiers, aller à l'horodatage, JSON                        |
| M5+   | P2 : sources commande/stdin/SSH, `.gz`, plugins, import BareTail                 |

## 9. Questions ouvertes

1. **Nom** de l'outil (`log-tail` est provisoire).
2. **OS prioritaire** : Windows (comme BareTail, poste pro ?) — l'hypothèse retenue ici — ou Linux/macOS ?
3. **Format de config** : JSON (cohérent avec le reste du monorepo) ou TOML (plus agréable à la main) ?
4. Les **sources non-fichier** (commande, Docker, SSH) sont-elles vraiment P2, ou un besoin du quotidien ?
5. Faut-il une **version CLI/TUI** en plus de l'appli graphique (utile en SSH sur le NAS) ? Le moteur
   étant séparé (cf. architecture), c'est possible à coût modéré.
