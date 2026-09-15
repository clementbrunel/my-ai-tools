# my-money-hub — Spécification

Agrégateur de comptes bancaires/assurance-vie **pour un usage strictement personnel** — alternative auto-hébergée à Linxo/Bankin. Objectif : moins de connecteurs à maintenir (8 comptes vs des millions d'utilisateurs chez Linxo), donc en théorie plus fiable. Mono-utilisateur, pas d'auth — protégé uniquement par le réseau local/VPN.

## Vue d'ensemble

```
Institutions (config manuelle)          Backend (Spring Boot)
┌──────────────────────┐   POST /api/sync ou /api/institutions/{id}/sync
│ Boursorama, N26,       │ ───┐
│ Revolut                │    ├──► EnableBankingConnector ──┐
│ BNP Paribas             │    ├──► WoobConnector ───────────┤
│ Mon Petit Placement,    │    └──► ManualConnector ──────────┤
│ SwissLife, Foyer,       │                                  │
│ AFI-ESCA                │                                  ▼
└──────────────────────┘                         SyncService (dispatch par
                                                    Institution.connectorType)
                                                          │
                                     accounts / transactions / balance_snapshots
                                                          │ (Postgres)
                                                          ▼
                                        GET /api/accounts, /api/accounts/net-worth
                                                          │
                                                          ▼
                                    Frontend (Vite/React) — Dashboard : patrimoine
                                    total + carte par compte + bouton "Synchroniser"
```

## Stack

| Composant | Choix |
|---|---|
| Backend | Java 21 + Spring Boot 3.5.16 (aligné sur `prono-core`) |
| Frontend | React 19 + TypeScript + Vite + Tailwind 4 |
| Base de données | PostgreSQL 16 — comptes, transactions, historique de solde (Flyway pour les migrations) |
| Connecteurs | Enable Banking (API DSP2 officielle) pour les banques couvertes, woob (scraping CLI) pour BNP, saisie manuelle pour les assurances-vie |
| Docker | `docker-compose.yml` (postgres + backend + frontend + pgAdmin), sur le modèle de `prono-core` |

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

## Modèle de données (Postgres)

- **`institutions`** — une banque/assureur (`name`, `type` = `BANK`|`INSURANCE`|`INVESTMENT`, `connector_type` = `ENABLE_BANKING`|`WOOB`|`MANUAL`, `external_ref` = référence connecteur : ASPSP Enable Banking, nom de module woob, etc.)
- **`accounts`** — un compte chez une institution (`label`, `iban`, `type`, `current_balance`, `external_account_id` pour matcher entre syncs, `last_synced_at`)
- **`balance_snapshots`** — un point d'historique de solde par compte, écrit à chaque sync (base de l'historique de patrimoine)
- **`transactions`** — mouvements par compte, dédupliqués par `external_id` (contrainte unique)

## API (MVP)

| Endpoint | Rôle |
|---|---|
| `GET /api/institutions` | Liste les institutions configurées |
| `POST /api/institutions` | Ajoute une institution (name, type, connectorType, externalRef) |
| `GET /api/accounts` | Liste tous les comptes |
| `GET /api/accounts/net-worth` | Patrimoine total + détail par compte |
| `POST /api/sync` | Synchronise toutes les institutions |
| `POST /api/institutions/{id}/sync` | Synchronise une seule institution |

## Connecteurs (`backend/src/main/java/com/mymoneyhub/connector/`)

Interface `BankConnector` (un par `Institution.ConnectorType`), dispatché par `SyncService` :

- **`EnableBankingConnector`** — couvre Boursorama, N26, Revolut. Tourne sur le tier gratuit **Restricted Production** d'Enable Banking (comptes liés soi-même, usage non-commercial — voir `enablebanking.com/docs/faq`).
- **`WoobConnector`** — couvre BNP Paribas. Shell out vers le CLI `woob` (`ProcessBuilder`, parsing JSON), suppose `woob` installé et le backend `bnp` déjà configuré en dehors de cette app (`woob config add bnp` — cette app ne stocke pas les identifiants bancaires).
- **`ManualConnector`** — no-op pour les institutions sans connecteur automatisé (les 4 comptes d'assurance-vie/investissement).

## Ce qui est volontairement en placeholder (MVP)

- **`EnableBankingConnector`** — **pas implémenté**. Le flow d'auth JWT (application-id + clé privée), le consentement et le format exact des endpoints comptes/transactions restent à écrire contre la vraie doc (`enablebanking.com/docs/api`) et une application créée sur leur Control Panel. `fetchAccounts`/`fetchTransactions` lèvent `UnsupportedOperationException` en attendant.
- **`WoobConnector`** — implémentation écrite mais **syntaxe CLI non vérifiée** (`woob bank -f json list/history`) — à confirmer avec `woob bank --help` sur une install réelle avant le premier run.
- **Saisie manuelle** — pas encore de formulaire côté frontend pour entrer/mettre à jour à la main le solde des comptes `MANUAL` (assurances-vie).
- **Scheduling** — pas de `@Scheduled` sur `SyncService.syncAll()`, sync déclenchée manuellement via l'API pour l'instant.
- **Historique de patrimoine** — `balance_snapshots` est déjà alimenté à chaque sync, mais rien ne l'affiche encore côté frontend (pas de graph).

Ces points sont derrière des interfaces stables (`BankConnector`) dont l'implémentation s'affinera sans toucher au reste du pipeline (entités, `SyncService`, API, frontend).

## Prochaines étapes

1. Implémenter `EnableBankingConnector` (créer une app en Restricted Production, lire la doc JWT, wire les 3 banques)
2. Vérifier/adapter `WoobConnector` contre une install réelle de woob + BNP
3. Ajouter un formulaire de saisie manuelle de solde pour les comptes `MANUAL`
4. Scheduling automatique du sync (`@Scheduled` sur `SyncService.syncAll()`)
5. Historique/graph de patrimoine dans le temps (déjà stocké via `balance_snapshots`, pas encore affiché)
