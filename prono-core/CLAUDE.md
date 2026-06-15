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
# Start DB first
docker compose up postgres -d

# In backend/
./mvnw spring-boot:run   # listens on :8080
```

### Frontend only
```bash
cd frontend
npm install
npm run dev   # listens on :5173, proxies /api → localhost:8090
```

### Production
```bash
export REGISTRY=myregistry:5000   # set your private registry
./build-and-push.sh [VERSION]     # builds & pushes Docker images

# On the production host:
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## Structure

```
prono-core/
├── backend/
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/java/com/pronocore/
│       ├── PronoCoreApplication.java
│       ├── aspect/
│       ├── config/          # SecurityConfig, AppConfig, …
│       ├── controller/      # 12 REST controllers
│       ├── dto/             # request/ + response/ DTOs
│       ├── entity/          # 13 JPA entities
│       ├── mapper/          # MapStruct mappers
│       ├── repository/      # Spring Data JPA
│       ├── security/        # JwtTokenProvider, JwtAuthFilter, UserDetailsServiceImpl
│       └── service/         # 14 services (+ ReminderScheduler)
│   └── src/main/resources/
│       ├── application.yml
│       └── db/migration/    # Flyway V1–V28
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios clients (auth, bets, groups, matches, …)
│   │   ├── components/      # 17+ shared components
│   │   ├── context/         # AuthContext, GroupAdminCountsContext, ToastProvider
│   │   ├── hooks/
│   │   ├── pages/           # 18+ route pages
│   │   ├── types/index.ts   # All TypeScript interfaces
│   │   └── utils/           # matchCalculations, dates, countryFlags
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docker-compose.yml        # dev
├── docker-compose.prod.yml   # prod
├── .env.example
├── dev.sh / dev-back.sh
└── build-and-push.sh
```

## Environment Variables

Copy `.env.example` to `.env` at the root.

| Variable | Default | Description |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/pronocore` | JDBC URL |
| `DB_USER` | `pronocore` | DB username |
| `DB_PASS` | `pronocore` | DB password |
| `JWT_SECRET` | *(change in prod)* | HS256 signing key |
| `RESEND_API_KEY` | — | Resend.com API key for emails |
| `FRONTEND_URL` | `http://localhost:5173` | Used in CORS & email links |
| `DEMO_PASSWORD` | `prono2026` | Password for seeded demo accounts |

## Backend Key Facts

- **Package root**: `com.pronocore`
- **Security**: JWT Bearer token (24h), BCrypt passwords, stateless sessions
- **Roles**: `PLATFORM_ADMIN` | `USER` (platform-wide) + `GROUP_ADMIN` | `MEMBER` (per group)
- **Public endpoints**: `/api/auth/**`, `/swagger-ui/**`, `/v3/api-docs`
- **Admin endpoints**: `/api/admin/**` → requires `PLATFORM_ADMIN`
- **DB migrations**: Flyway, auto-repair enabled (safe for dev)
- **Email**: Resend API (Spring Mail wrapper)
- **Scheduling**: `ReminderScheduler` — email reminders, daily gage auto-settlement

### Entities (13)
`User`, `Match`, `Group`, `GroupMember`, `Bet`, `BetParticipation`, `Forfeit`, `UserForfeit`, `ForfeitVote`, `DailyGage`, `DailyGageCandidate`, `DailyGageVote`, `PasswordResetToken`

### Controllers → API routes
| Controller | Base path |
|---|---|
| AuthController | `/api/auth` |
| UserController | `/api/users` |
| MatchController | `/api/matches` |
| BetController | `/api/bets` |
| GroupController | `/api/groups` |
| ForfeitController | `/api/forfeits` |
| DailyGageController | `/api/daily-gages` |
| DashboardController | `/api/dashboard` |
| LeaderboardController | `/api/leaderboard` |
| AdminUserController | `/api/admin/users` |
| AdminCountsController | `/api/admin/counts` |
| AdminEmailController | `/api/admin/email` |

### Key files
- `src/main/resources/application.yml` — all Spring config
- `config/SecurityConfig.java` — CORS, auth rules, filter chain
- `db/migration/` — schema history (V1 = initial schema, V12 = groups, V24-V25 = email verification)

## Frontend Key Facts

- **React Router 6** — routes defined in `src/App.tsx`
- **Axios** — all API calls in `src/api/`, base URL `/api` (proxied by Vite in dev)
- **Auth state** — `AuthContext` holds current user + JWT; stored in `localStorage`
- **Tailwind CSS** — custom color `wc-dark` (World Cup dark theme), no UI library
- **No tests** (same as rest of monorepo)

### Routes
`/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/dashboard`, `/matches`, `/matches/:id`, `/leaderboard`, `/gages`, `/profile`, `/groups`, `/open-betting`, `/admin`

### Key files
- `src/App.tsx` — routing + PrivateRoute wrapper
- `src/types/index.ts` — all TypeScript interfaces (start here when adding features)
- `vite.config.ts` — `/api` proxy to backend port 8090

## Tests unitaires (backend)

JUnit 5 + Mockito — tous dans `backend/src/test/java/com/pronocore/service/`.

```bash
cd backend
mvn test
```

| Fichier de test | # tests | Ce qui est couvert |
|---|---|---|
| `BetServiceTest` | 18 | Création de paris, participation, validation, settlement, forfeits assignés |
| `DailyGageServiceTest` | 33 | Création, VOTE/DIRECT, vote candidat, force-settle, statuts |
| `GroupServiceTest` | 23 | Création groupe, rejoindre, appliquer, approuver, rôles membres |
| `MatchServiceTest` | 19 | CRUD matchs, mise à jour scores, filtrage par status |
| `ForfeitServiceTest` | 15 | Proposition, visibilité (shared/groupe), marquer complété, votes |
| `LeaderboardServiceTest` | 7 | Classement global et par groupe |
| `DashboardServiceTest` | 6 | Stats utilisateur, matchs à venir |
| `UserServiceTest` | 10 | Profil, mot de passe, displayName, avatar, reminder toggle |
| `AuthServiceTest` | 4 | Register, login, vérification email, reset password |
| `AdminCountsServiceTest` | 6 | Compteurs admin (users, groups, matches, bets) |

Les services sont testés en isolation (mocks des repositories via Mockito). Pas de tests d'intégration ni de tests frontend.

## Domain Concepts

**Bet types**: `SCORE` (predict exact score), `EVENT` (predict an event), `FORFEIT`, `FREE`

**Bet status flow**: `OPEN` → `VALIDATED` | `CANCELLED`

**Daily Gage ("gage quotidien")**: Each match day, one group member gets assigned a forfeit (penalty). Two modes:
- `DIRECT` — admin picks directly
- `VOTE` — group votes on candidates, worst-scoring player gets it

**Forfeit visibility**:
- `proposedBy = null` + `group = null` → shared globally (admin-created)
- `group != null` → private to that group (player-proposed)

**Scoring**: `globalScore` and `betsWon` on User updated when bets are validated. Group leaderboard ranks members by score within the group.
