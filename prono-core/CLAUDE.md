# prono-core — World Cup 2026 Betting App

Full-stack app: **Java 21 + Spring Boot 3.5.16** (backend) + **React 18 + TypeScript + Vite** (frontend) + **PostgreSQL 16** (database).

## Running the Project

### Full stack (dev)
```bash
cd prono-core
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8090
- Swagger UI: http://localhost:8090/swagger-ui.html
- pgAdmin: http://localhost:5050 (PGADMIN_EMAIL / PGADMIN_PASSWORD du .env → host=postgres, user=pronocore, pass=DB_PASS)

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
| `FOOTBALL_DATA_API_KEY` | API key football-data.org pour la sync des scores foot — vide = sync désactivée |
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
- **APIs externes** : table `external_apis` (code, sport, base_url) — registre des fournisseurs de données, un par sport. `jolpica-f1` alimente la F1, `football-data.org` le foot (choisi plutôt qu'api-football car son plan gratuit ne couvre pas la saison en cours). Les deux clients résolvent leur base URL depuis ce registre au premier appel, avec repli sur `application.yml`. Les dates fournisseur sont converties via `AppTime.APP_ZONE` (Europe/Paris), jamais tronquées.

## Frontend

- Routes définies dans `src/App.tsx`, types centralisés dans `src/types/index.ts`
- Tous les appels API dans `src/api/`, proxiés vers le backend en dev via Vite
- Auth JWT stocké dans `localStorage` via `AuthContext`

## Tests unitaires (backend)

JUnit 5 + Mockito — `backend/src/test/java/com/pronocore/service/`

```bash
cd backend && mvn test
```

Fichiers de test couvrant tous les services (BetService, DailyGageService, GroupService, MatchService, ForfeitService, LeaderboardService, DashboardService, UserService, AuthService, GroupAdminService, F1RaceService, F1SyncService, MatchSyncService, FootballDataClient…). Tests frontend : Vitest (`cd frontend && npm test`). Pas de tests d'intégration.

Les clients HTTP externes sont abstraits derrière une interface (`JolpicaClient` pour la F1, `FootballDataHttpClient` pour le foot) afin que le parsing puisse être testé avec des payloads JSON figés, sans appel réseau.

## Domain Concepts

**Types de paris** : `SCORE` (score exact), `EVENT`, `FORFEIT`, `FREE`, `RACE_PICKS` (prono F1) — statuts : `OPEN` → `VALIDATED` | `CANCELLED`

**Sports** : un groupe joue à un ou plusieurs sports (`FOOT`, `F1` — table `group_sports`). Les GP F1 ne s'ouvrent que dans les groupes F1.

**Module F1** : un pari F1 est un `bet` ordinaire avec `race_id` (exclusif de `match_id`) ; le détail du prono « Podium + » (P1/P2/P3, pole, meilleur tour, lanterne rouge — max 14 pts, bonus Grand Chelem) vit dans `f1_predictions`. La pole se verrouille aux qualifs, le reste au départ. L'import jolpica ne crée qu'un **brouillon** (`race_results` sur une course encore `UPCOMING`, visible admin seulement) ; le règlement a lieu à la validation admin (onglet 🏎 F1, `enterResults`), qui seule envoie l'email aux joueurs. Même flux pour la **grille de départ** : l'import jolpica (`qualifying_results`) est un brouillon (`races.qualifying_validated = false`, visible admin seulement) que l'admin corrige ou saisit à la main (jolpica en retard) puis valide (`enterQualifyingResults`) ; une grille validée est publiée aux joueurs et n'est plus écrasée par le sync saison (seul le resync forcé la remplace), et la pole d'un brouillon de classement est réalignée sur le nouveau P1. Les brouillons (classement et grille) ne sortent que par `GET /api/admin/f1/races/{id}` (onglet admin, sous-onglets Course / Qualifs) — jamais par l'endpoint joueur, même pour un admin. Un scheduler (`F1ResultsImportSchedulerService`) tente l'import automatiquement toutes les 30 min — la grille entre la fin des qualifs et le départ, le classement après la fin du GP — et prévient les admins par email quand un brouillon est prêt ; si jolpica n'a toujours pas la grille 6 h après les qualifs (`app.f1-auto-import.qualifying-late-alert-hours`), un email unique leur demande de la saisir à la main (`races.qualifying_late_alert_sent`). Le règlement (saisie admin du classement, onglet 🏎 F1) écrit `points_earned` → classement/gages/forfeits inchangés. Standings pilotes/constructeurs calculés depuis `race_results` — barème FIA courses (25…1) **et sprints (8…1, `sprint_position` importé via jolpica, sans paris)**. Voir `docs/f1-proposal.md`.

**Gage quotidien** : chaque jour de match, un membre du groupe hérite d'un forfeit. Mode `DIRECT` (admin choisit) ou `VOTE` (le groupe vote, le moins bien classé l'obtient).

**Visibilité des forfeits** : global si `group = null`, privé au groupe sinon.
