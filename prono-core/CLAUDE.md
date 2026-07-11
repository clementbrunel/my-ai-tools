# prono-core — World Cup 2026 Betting App

Full-stack app: **Java 21 + Spring Boot 3.3.11** (backend) + **React 18 + TypeScript + Vite** (frontend) + **PostgreSQL 16** (database).

## Running the Project

### Full stack (dev)
```bash
cd prono-core
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8090
- Swagger UI: http://localhost:8090/swagger-ui.html
- pgAdmin: http://localhost:5050 (admin@local.dev / admin → host=postgres, user=pronocore, pass=pronocore)

### Backend only
```bash
docker compose up postgres -d
cd backend && ./mvnw spring-boot:run   # listens on :8080
```

### Frontend only
```bash
cd frontend && npm install && npm run dev   # listens on :5173, proxies /api → localhost:8090
```

### Production
```bash
export REGISTRY=myregistry:5000
./build-and-push.sh [VERSION]

# On the production host:
docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d
```

## Structure

| Dossier | Rôle |
|---|---|
| `backend/` | Spring Boot app — config, controllers, services, entities, migrations Flyway (`db/migration/`) |
| `frontend/` | React app — pages, composants, API clients Axios, types TypeScript |
| `docker-compose.yml` | Stack dev complète (backend + frontend + postgres + pgAdmin) |
| `docker-compose.prod.yml` | Stack prod (images pré-buildées depuis registry privé) |
| `build-and-push.sh` | Build et push des images Docker vers le registry |

## Environment Variables

Copier `.env.example` → `.env`.

| Variable | Description |
|---|---|
| `DB_USER` / `DB_PASS` | Credentials PostgreSQL |
| `JWT_SECRET` | Clé de signature JWT (changer en prod) |
| `RESEND_API_KEY` | API key Resend.com pour les emails |
| `FRONTEND_URL` | Utilisé pour CORS et les liens dans les emails |
| `CORS_EXTRA_ORIGIN` | Origine CORS supplémentaire optionnelle (ex: accès réseau local) |
| `REGISTRY` | Adresse du registry Docker privé (pour build-and-push.sh) |

## Backend

- **Sécurité** : JWT Bearer (24h), BCrypt, sessions stateless
- **Rôles** : `PLATFORM_ADMIN` / `USER` (global) + `GROUP_ADMIN` / `MEMBER` (par groupe)
- **Routes publiques** : `/api/auth/**`, `/swagger-ui/**`
- **Routes admin** : `/api/admin/**` → `PLATFORM_ADMIN` requis
- **Migrations** : Flyway avec auto-repair activé
- **Email** : Resend API — vérification compte, reset password, rappels de match
- **Scheduling** : rappels email et settlement automatique des gages quotidiens

## Frontend

- Routes définies dans `src/App.tsx`, types centralisés dans `src/types/index.ts`
- Tous les appels API dans `src/api/`, proxiés vers le backend en dev via Vite
- Auth JWT stocké dans `localStorage` via `AuthContext`

## Tests unitaires (backend)

JUnit 5 + Mockito — `backend/src/test/java/com/pronocore/service/`

```bash
cd backend && mvn test
```

11 fichiers de test couvrant tous les services (BetService, DailyGageService, GroupService, MatchService, ForfeitService, LeaderboardService, DashboardService, UserService, AuthService, AdminCountsService, F1RaceService). Tests frontend : Vitest (`cd frontend && npm test`). Pas de tests d'intégration.

## Domain Concepts

**Types de paris** : `SCORE` (score exact), `EVENT`, `FORFEIT`, `FREE`, `RACE_PICKS` (prono F1) — statuts : `OPEN` → `VALIDATED` | `CANCELLED`

**Sports** : un groupe joue à un ou plusieurs sports (`FOOT`, `F1` — table `group_sports`). Les GP F1 ne s'ouvrent que dans les groupes F1.

**Module F1** : un pari F1 est un `bet` ordinaire avec `race_id` (exclusif de `match_id`) ; le détail du prono « Podium + » (P1/P2/P3, pole, meilleur tour, lanterne rouge — max 14 pts, bonus Grand Chelem) vit dans `f1_predictions`. La pole se verrouille aux qualifs, le reste au départ. Le règlement (saisie admin du classement, onglet 🏎 F1) écrit `points_earned` → classement/gages/forfeits inchangés. Standings pilotes/constructeurs calculés depuis `race_results` (barème FIA). Voir `docs/f1-proposal.md`.

**Gage quotidien** : chaque jour de match, un membre du groupe hérite d'un forfeit. Mode `DIRECT` (admin choisit) ou `VOTE` (le groupe vote, le moins bien classé l'obtient).

**Visibilité des forfeits** : global si `group = null`, privé au groupe sinon.
