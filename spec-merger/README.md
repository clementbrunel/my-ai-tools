# spec-merger

Fusionne la spécification Word d'un projet JWAY avec son code JXML en un markdown unique, éditable et versionné.

## Lancer le projet

### Stack complète (dev)

```bash
cp .env.example .env   # puis éditer DB_USER/DB_PASS si besoin
docker compose up --build
```

- Frontend : http://localhost:3001
- Backend API : http://localhost:8091
- Swagger UI : http://localhost:8091/swagger-ui.html

### Backend seul

```bash
docker compose up postgres -d
cd backend && mvn spring-boot:run   # écoute sur :8080
```

### Frontend seul

```bash
cd frontend && npm install && npm run dev   # écoute sur :5173, proxy /api → localhost:8091
```

## Structure

| Dossier | Rôle |
|---|---|
| `backend/` | Spring Boot — parsing Word/JXML, accès sources GitLab (gitlab4j-api), diff, résolution IA (mistral-vibe), génération markdown, historique des versions (migrations Flyway dans `db/migration/`) |
| `frontend/` | React — 3 panneaux (Word / markdown éditable / JXML), historique des versions, export markdown |
| `docker-compose.yml` | Stack dev complète (backend + frontend + postgres) |

## Variables d'environnement

Copier `.env.example` → `.env`. Voir ce fichier pour le détail de chaque variable (credentials Postgres, URL frontend pour CORS, config mistral-vibe, config GitLab).

## Gabarit de documentation attendue

`backend/src/main/resources/templates/documentation-template.md` définit la forme que
doit toujours prendre la documentation produite par l'IA — côté Word (spec déclarée)
comme côté JXML (code réel) — afin que les deux versions restent structurellement
comparables et diffable section par section, écran par écran, élément par élément.
À utiliser comme contexte de génération dès que l'IA produit ou reformule de la
documentation fonctionnelle (aujourd'hui la résolution des divergences Word/JXML,
demain la génération depuis PowerPoint/Word/Excel).

## Source JXML via GitLab (#266)

En plus de l'upload d'une archive `.zip` ou du texte collé, la spec JXML peut être
récupérée directement depuis un projet GitLab. Les projets JWAY sont répartis sur
**deux groupes GitLab, chacun avec sa propre convention de fichiers de traduction** :
noms de fichiers fixes `de.properties`/`en.properties`/`fr.properties` dans l'un,
fichiers `.xlf` dans l'autre. Chaque groupe est donc configuré séparément
(`GITLAB_GROUP_1_*` / `GITLAB_GROUP_2_*` dans `.env.example`), avec sa propre `KEY`,
son chemin (`PATH`) et ses patterns Ant de fichiers à inclure.

1. Renseigner `GITLAB_URL`, `GITLAB_TOKEN`, puis pour chaque groupe `GITLAB_GROUP_n_PATH`
   (chemin complet du groupe/sous-groupe, ex. `mon-groupe/sous-groupe`, ou son ID
   numérique) et éventuellement `GITLAB_GROUP_n_TRANSLATION_PATTERNS` /
   `GITLAB_GROUP_n_JAVA_PATTERNS` si les valeurs par défaut ne conviennent pas. Un
   groupe dont le `PATH` est vide est simplement ignoré.
2. `GET /api/gitlab/projects` liste les projets des groupes configurés, chacun tagué
   avec la `groupKey` du groupe dont il provient.
3. `POST /api/analysis` avec `gitlabGroupKey` + `gitlabProjectId` (ID ou chemin du
   projet) télécharge uniquement les fichiers pertinents du projet — les `.jxml`
   (toujours inclus), les ressources de traduction propres au groupe, et, si
   configuré, les classes Java d'appels métier vers l'extérieur — au lieu du reste
   du dépôt (build, tests, assets, ...).
