# my-money-hub — Agrégateur de comptes perso

Full-stack app: **Java 21 + Spring Boot 3.5.16** (backend) + **React 19 + TypeScript + Vite** (frontend) + **PostgreSQL 16** (database).

Détail fonctionnel/technique (couverture par institution, modèle de données, API, état des connecteurs) : voir les [issues GitHub du projet](https://github.com/clementbrunel/my-ai-tools/issues?q=label%3Amy-money-hub).

## Running the Project

### Full stack (dev)
```bash
cd my-money-hub
docker compose up --build
```
- Frontend: http://localhost:3001
- Backend API: http://localhost:8091
- Swagger UI: http://localhost:8091/swagger-ui.html
- pgAdmin: http://localhost:5051

### Backend only

Option 1 — script (backend + postgres + pgAdmin dans Docker, suit les logs) :
```bash
./dev-back.sh
```

Option 2 — Maven local (backend en dehors de Docker, plus rapide à itérer) :
```bash
docker compose up postgres -d
cd backend && mvn spring-boot:run   # listens on :8080
```

### Frontend only
```bash
cd frontend && npm install && npm run dev   # listens on :5173, proxies /api → localhost:8091
```

## Structure

| Dossier | Rôle |
|---|---|
| `backend/` | Spring Boot — entités, repositories, `connector/` (un `BankConnector` par institution), `service/SyncService` (orchestrateur) |
| `frontend/` | React — Dashboard (patrimoine total + liste des comptes) |
| `docker-compose.yml` | Stack dev (backend + frontend + postgres + pgAdmin) |

## Environment Variables

Copier `.env.example` → `.env` (déjà dans `.gitignore` racine du monorepo).
