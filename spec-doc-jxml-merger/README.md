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
| `backend/` | Spring Boot — parsing Word/JXML, diff, résolution IA (mistral-vibe), génération markdown, historique des versions (migrations Flyway dans `db/migration/`) |
| `frontend/` | React — 3 panneaux (Word / markdown éditable / JXML), historique des versions, export markdown |
| `docker-compose.yml` | Stack dev complète (backend + frontend + postgres) |

## Variables d'environnement

Copier `.env.example` → `.env`. Voir ce fichier pour le détail de chaque variable (credentials Postgres, URL frontend pour CORS, config mistral-vibe).
