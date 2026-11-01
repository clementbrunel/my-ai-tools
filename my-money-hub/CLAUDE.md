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

## Enable Banking (Boursorama, N26, Revolut)

`EnableBankingConnector` — JWT RS256 signé avec la clé de l'application (`EnableBankingJwtSigner`), consentement via
`POST /api/institutions/{id}/connect` → page de la banque → `GET /api/enable-banking/callback` (stocke la session sur
l'institution, migration `V2`) → redirection vers le dashboard. Ensuite `POST /api/institutions/{id}/sync` lit
`/sessions/{id}` puis `/accounts/{uid}/details|balances|transactions`. `externalAccountId` = `identification_hash`
(stable entre consentements). Consentement à renouveler à expiration (bouton « Reconnecter »).

## Comptes manuels (Mon Petit Placement, SwissLife, Foyer, AFI-ESCA)

Institutions `MANUAL` : `ManualConnector` ne découvre rien, les comptes et soldes se saisissent depuis le Dashboard.
`POST /api/institutions/{id}/accounts` crée un compte (+ premier snapshot) ; `PUT /api/accounts/{id}/balance`
met à jour `current_balance` et ajoute un `balance_snapshots`. Date optionnelle (défaut maintenant) : une date antérieure
au dernier snapshot n'alimente que l'historique. Refusé (409) pour une institution non `MANUAL`.

## Woob (BNP Paribas)

`WoobConnector` appelle la CLI woob (vérifiée sur woob 3.7 + module `bnp`) : `woob bank -b <backend> -f json -n 0 list`
puis `history <id@backend> <since>`. `Institution.externalRef` = nom du backend woob, configuré hors de l'app
(`pip install woob && woob config add bnp`). Erreurs backend détectées sur stderr (`Error(bnp)` / `Bug(bnp)`, woob
sortant parfois en 0 avec `[]`). Sync réel : `cd backend && WOOB_LIVE_BACKEND=bnp mvn test -Dtest=WoobConnectorLiveTest`.

## Import d'historique Linxo

`POST /api/import/linxo` (multipart `file`, `dryRun` — **true par défaut**, `choices` JSON) → `ImportService` + `importer/LinxoCsvParser`.
Un même export mélange plusieurs comptes : regroupement par `(Nom de la connexion, Nom du compte)`. CSV Linxo : colonnes lues
par nom d'en-tête, séparateur et encodage (UTF-8 / windows-1252) détectés, montants `1 234,56`, dates `JJ/MM/AAAA`.
- **Comptes** : déjà connu (`external_account_id = linxo:<hash>` ou même connexion + libellé) → rattaché ; sinon créé sous une
  institution `MANUAL` (archivé par défaut : `accounts.archived`, exclu du patrimoine). Choix par compte via `choices`
  (`LINK` / `CREATE_ACTIVE` / `CREATE_ARCHIVED`), modifiable dans la modale « Importer Linxo » du dashboard.
- **Transactions** : `source = LINXO`, `external_id` synthétique (hash date|montant|libellé|notes|n° d'occurrence) → réimport idempotent.
  La synchro fait foi : lignes Linxo datées à partir de la 1re transaction `SYNC` du compte ignorées.
- **Soldes** : l'export n'en contient pas — `balance_snapshots` de fin de mois (`source = LINXO`) recalculés depuis les opérations,
  ancrés sur `current_balance` si le compte est synchronisé, sinon cumulés depuis 0 (relatifs).
- **Fusion** : `POST /api/accounts/{id}/merge` (`{targetId}`) → `AccountMergeService`. Survivant = le compte d'une institution synchronisée
  (sinon la cible) ; transactions + snapshots déplacés, lignes `LINXO` datées à partir de la 1re transaction `SYNC` supprimées, snapshots
  `LINXO` recalculés (ancrés sur le solde synchronisé), l'autre compte supprimé. Action « Fusionner avec… » sur les cartes de comptes archivés.
