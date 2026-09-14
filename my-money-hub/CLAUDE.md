# my-money-hub — Agrégateur de comptes perso

Full-stack app: **Java 21 + Spring Boot 3.5.16** (backend) + **React 19 + TypeScript + Vite** (frontend) + **PostgreSQL 16** (database).

Remplace Linxo pour un usage strictement personnel (mono-utilisateur, pas d'auth — protégé par le réseau local/VPN uniquement). Objectif : moins de connecteurs que Linxo (8 comptes vs des millions d'utilisateurs), donc en théorie plus fiable.

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

## Couverture par institution (état au 2026-09-14)

| Compte | Connecteur | Statut |
|---|---|---|
| Boursorama | `ENABLE_BANKING` | ✅ API DSP2 officielle, confirmée intégrée chez Enable Banking |
| N26 | `ENABLE_BANKING` | ✅ confirmé intégré |
| Revolut | `ENABLE_BANKING` | ✅ confirmé intégré |
| BNP Paribas | `WOOB` | ✅ scraping via module woob `bnp` (ex-`bnporc`, renommé 2023, dernier fix substantiel 08/2024) |
| Mon Petit Placement | `MANUAL` | à qualifier — pas de connecteur automatisé pour l'instant |
| SwissLife | `MANUAL` | à qualifier |
| Foyer (Luxembourg) | `MANUAL` | à qualifier — hors juridiction FR (régulateur CSSF), probablement scraping maison à terme |
| AFI-ESCA | `MANUAL` | à qualifier |

DSP2/PSD2 ne couvre que les comptes de paiement (banques) — les produits d'assurance-vie et plateformes d'investissement en sont exclus par nature, d'où `MANUAL` par défaut pour ces 4-là en attendant un connecteur dédié (woob ou scraping maison).

## Connecteurs (`backend/src/main/java/com/mymoneyhub/connector/`)

- **`EnableBankingConnector`** — **pas encore implémenté**. Le flow d'auth JWT (application-id + clé privée), le consentement et le format des endpoints comptes/transactions restent à écrire contre la vraie doc (enablebanking.com/docs/api) et une application créée sur leur Control Panel en mode **Restricted Production** (gratuit, comptes liés soi-même, usage non-commercial — voir `docs/faq/`).
- **`WoobConnector`** — shell out vers le CLI `woob` (`ProcessBuilder`, parsing JSON). Suppose que `woob` est installé et le backend `bnp` déjà configuré en dehors de cette app (`woob config add bnp`) — cette app ne stocke pas les identifiants bancaires. **Vérifier la syntaxe exacte des sous-commandes** (`woob bank -f json list/history`) avec `woob bank --help` sur la version installée avant le premier run.
- **`ManualConnector`** — no-op, pour les institutions sans connecteur (solde saisi à la main via l'UI — pas encore de formulaire de saisie manuelle côté frontend, à ajouter).

## Prochaines étapes

1. Implémenter `EnableBankingConnector` (créer une app en Restricted Production, lire la doc JWT, wire les 3 banques)
2. Vérifier/adapter `WoobConnector` contre une install réelle de woob + BNP
3. Ajouter un formulaire de saisie manuelle de solde pour les comptes `MANUAL` (assurances-vie)
4. Scheduling automatique du sync (`@Scheduled` sur `SyncService.syncAll()`)
5. Historique/graph de patrimoine dans le temps (déjà stocké via `balance_snapshots`, pas encore affiché)
