# cbl-log

Visualiseur de logs temps réel pour Windows, portage moderne et personnalisable de [BareTail](https://www.baremetalsoft.com/baretail/) :
suivi instantané de fichiers de toute taille, **rolling géré sans perte de ligne**, surlignage regex,
filtres, parseurs de format, profils, vue fusionnée multi-fichiers.

> **Statut : version 2.1.0.**

- [Cahier des charges fonctionnel](./docs/cahier-des-charges-fonctionnel.md)
- [Dossier d'architecture](./docs/architecture.md)
- [Analyse : logs des conteneurs Docker Desktop](./docs/analyse-docker-desktop.md)

Pile : Electron + TypeScript + React (Windows 10/11).

## Rolling : archives chargées avec le fichier

À l'ouverture de `SystemOut.log`, les archives laissées à côté par le rolling (`SystemOut_26.10.21_09.30.46.log`…)
modifiées depuis moins de **2 h** sont chargées avant lui : l'onglet se lit comme un seul fichier, avec un
séparateur à chaque archive. Quand des archives plus anciennes existent, un avertissement le signale.

- La durée se règle dans `%APPDATA%\cbl-log\settings.json` : `"historyHours": 6` (0 = le fichier seul).
- Noms reconnus d'office : `<nom>_<date>.log` (WebSphere, Liberty), `<nom>.<date>.<n>.log` (Logback), `<nom>.log.1`.
  Pour un autre nommage, clic droit sur le chemin du fichier › **Désigner une archive du rolling…** et choisir une
  archive : cbl-log en déduit le motif, le retient pour ce fichier et rouvre l'onglet.
- La recherche et le filtre ne portent pour l'instant que sur le fichier courant.

## Partager un profil de surlignage

Dans **Règles de surlignage**, `Exporter…` enregistre le profil affiché dans un fichier `.json` à envoyer
à vos collègues ; `Importer…` l'ajoute chez eux et l'applique à l'onglet affiché. Si un profil de même id
existe déjà (deux versions du même profil), cbl-log propose de le remplacer ou de garder les deux. Le fichier
exporté a le même format que ceux de `%APPDATA%\cbl-log\rules\` : il peut aussi y être déposé directement.

## Développement

Monorepo npm workspaces : `packages/shared` (types + schémas zod), `packages/engine` (moteur TS pur Node, testé avec vitest), `app` (Electron + electron-vite + React 18).

```bash
cd cbl-log
npm install        # installe les dépendances (npm ci en CI)
npm run dev        # reconstruit shared + engine puis lance l'app Electron en mode dev (electron-vite)
npm run typecheck  # tsc --noEmit sur tous les workspaces
npm test           # vitest (moteur + app)
npm run build      # build shared, engine puis app (sortie app/out)
npm run package    # installeur NSIS + exe portable dans release/ (Windows x64)
npm run package:dir  # idem sans installeur : release/win-unpacked/cbl-log.exe
```

## Packaging et release

`electron-builder.yml` produit `cbl-log-Setup-<version>.exe` (NSIS, installation par utilisateur) et `cbl-log-<version>-portable.exe`. Pour alléger les binaires, seules les locales Chromium `fr` et `en-US` sont embarquées et la compression est au maximum (`compression: maximum`).
Pas de télémétrie (NF-07). Les exécutables ne sont pas signés : Windows SmartScreen peut afficher un avertissement
au premier téléchargement depuis le navigateur.

### Mise à jour depuis l'application

Une fois installé, cbl-log se met à jour seul à partir des releases GitHub, sans retourner sur le dépôt :

- **Au démarrage** (5 s après l'ouverture), l'app interroge l'API GitHub des releases `cbl-log-v*`. Si une version
  plus récente existe, une fenêtre propose **Installer maintenant / Voir les notes / Plus tard**.
- **Aide › Rechercher une mise à jour…** lance la même vérification à la demande (et dit si l'app est à jour).
- *Installer maintenant* télécharge l'exécutable de la release (taille et SHA-256 vérifiés), puis :
  - version installée : installeur NSIS en silencieux dans le même dossier, cbl-log redémarre et rouvre les onglets ;
  - version portable : le nouveau `cbl-log-<version>-portable.exe` est posé à côté de l'actuel et lancé (l'ancien
    peut être supprimé).
- `"checkForUpdates": false` dans `%APPDATA%\cbl-log\settings.json` désactive la vérification au démarrage et toutes les heures (le menu
  reste disponible). C'est le seul accès réseau de l'application : une requête GET vers `api.github.com`, rien n'est
  envoyé.

### Conteneurs Docker (Docker Desktop)

Le bouton baleine de la barre d'onglets (ou `Ctrl+Maj+D`) ouvre le panneau **Docker** : conteneurs groupés par projet
compose, pastille d'état (running / exited), filtre texte, double-clic pour ouvrir, `Ctrl` / `Maj` + clic puis
*Ouvrir* pour plusieurs à la fois. L'en-tête indique la connexion (« Connecté à Docker Desktop 4.x, API 1.xx ») ou
ce qu'il faut faire (Docker non lancé, compte hors groupe `docker-users`, version trop ancienne). Lecture seule.

- Un onglet par conteneur (icône baleine + nom). Il est identifié par le **nom** : si `docker compose up` recrée le
  conteneur, l'onglet continue et un séparateur « conteneur recréé » apparaît.
- Barre d'état : « Docker · running depuis 10:02 », « arrêté » ou « en attente de Docker ». *Charger plus
  d'historique* remonte ×10 plus loin (la copie locale des logs est reconstruite, la position est conservée).
- Session et fichiers récents retiennent `docker://<contexte>/<nom>` et se raccrochent au conteneur du même nom.
- Réglages (`settings.json`, pris en compte au prochain lancement sauf `enabled` et `initialTail`) :
  `"docker": { "enabled": true, "host": "tcp://127.0.0.1:2375", "initialTail": 5000, "spoolMaxMb": 256, "keepSpoolOnClose": false }`
  (`host` absent : `DOCKER_HOST`, puis le contexte Docker courant, puis le pipe de Docker Desktop).

### Signaler un bug / proposer une idée

**Aide › Signaler un bug / proposer une idée…** ouvre un panneau (type Bug ou Idée, titre, description, case
« Joindre la version et le système »). Le bouton **Ouvrir sur GitHub…** ouvre dans le navigateur la page
« New issue » du dépôt, pré-remplie (titre préfixé `[cbl-log]`, labels `cbl-log` + `bug`/`enhancement`) :
l'utilisateur relit et envoie l'issue avec son propre compte GitHub. L'application n'envoie rien elle-même et
n'embarque aucun jeton (NF-07) ; aucun chemin de fichier ni contenu de log n'est ajouté.

Anti-flood, en plus de celui de GitHub (compte et clic obligatoires) : 5 min minimum entre deux signalements,
3 par 24 h glissantes, et un même titre (casse et accents ignorés) refusé pendant 30 jours. L'historique est
dans `%APPDATA%\cbl-log\feedback.json`. Les labels passés dans l'URL ne s'appliquent que pour les comptes ayant
le droit de trier les issues du dépôt ; pour les autres, le préfixe `[cbl-log]` du titre permet de les retrouver.

Publier une version : poser un tag `cbl-log-vX.Y.Z` sur `main` et le pousser. Le job `release` du workflow
`cbl-log – CI` construit les deux exécutables (version issue du tag) et les attache à une release GitHub.
