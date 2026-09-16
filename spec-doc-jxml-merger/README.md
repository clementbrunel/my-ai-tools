# spec-doc-jxml-merger

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

## Source JXML via GitLab (#266)

En plus de l'upload d'une archive `.zip` ou du texte collé, la spec JXML peut être
récupérée directement depuis un projet GitLab :

1. Renseigner `GITLAB_URL`, `GITLAB_TOKEN` et `GITLAB_SUBGROUP` (nom complet du
   sous-groupe, ex. `mon-groupe/mon-sous-groupe`, ou son ID numérique).
2. `GET /api/gitlab/projects` liste les projets du sous-groupe.
3. `POST /api/analysis` avec `gitlabProjectId` (ID ou chemin du projet) télécharge
   uniquement les fichiers pertinents du projet — les `.jxml`, les ressources de
   traduction (`GITLAB_TRANSLATION_PATTERNS`), et, si configuré, les classes Java
   d'appels métier vers l'extérieur (`GITLAB_JAVA_PATTERNS`) — au lieu du reste du
   dépôt (build, tests, assets, ...).
