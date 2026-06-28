# Modèle de données — Prono Core

## Diagramme Entité-Relation

```mermaid
erDiagram
    users {
        bigserial id PK
        varchar username UK
        varchar email UK
        text password
        varchar role
        varchar display_name
        varchar avatar_url
        int global_score
        int bets_won
        int forfeits_received
        boolean email_verified
        varchar verification_token
        timestamp token_expiry
        boolean email_reminder_enabled
        date reminder_sent_date
        boolean email_gage_enabled
        timestamp created_at
    }

    groups {
        bigserial id PK
        varchar name
        text description
        varchar invite_code UK
        boolean is_private
        bigint created_by FK
        timestamp created_at
    }

    group_members {
        bigserial id PK
        bigint group_id FK
        bigint user_id FK
        varchar role
        varchar status
        timestamp joined_at
    }

    matches {
        bigserial id PK
        varchar team_a
        varchar team_b
        timestamp match_date
        int score_a
        int score_b
        varchar status
        varchar competition
        varchar round
        boolean reminder_sent
    }

    bets {
        bigserial id PK
        varchar title
        text description
        bigint group_id FK
        bigint match_id FK
        bigint creator_id FK
        varchar bet_type
        int points
        timestamp deadline
        varchar status
        varchar winning_option
        timestamp created_at
    }

    bet_participations {
        bigserial id PK
        bigint bet_id FK
        bigint user_id FK
        varchar chosen_option
        text comment
        int points_earned
        timestamp created_at
    }

    forfeits {
        bigserial id PK
        varchar title
        text description
        varchar category
        boolean is_active
        int times_completed
        bigint proposed_by_id FK
        bigint group_id FK
    }

    forfeit_votes {
        bigserial id PK
        bigint forfeit_id FK
        bigint user_id FK
        int vote
    }

    user_forfeits {
        bigserial id PK
        bigint user_id FK
        bigint forfeit_id FK
        bigint assigned_by_id FK
        bigint bet_id FK
        bigint group_id FK
        boolean is_completed
        timestamp completed_at
        timestamp assigned_at
    }

    group_forfeits {
        bigserial id PK
        bigint group_id FK
        varchar title
        text description
        varchar category
        boolean is_active
        int times_completed
        bigint proposed_by_id FK
        timestamp created_at
    }

    group_user_forfeits {
        bigserial id PK
        bigint group_id FK
        bigint user_id FK
        bigint forfeit_id FK
        bigint assigned_by_id FK
        bigint bet_id FK
        boolean is_completed
        timestamp completed_at
        timestamp assigned_at
    }

    daily_gages {
        bigserial id PK
        bigint group_id FK
        date match_date
        bigint forfeit_id FK
        varchar mode
        varchar status
        bigint assigned_to_id FK
        timestamp assigned_at
        timestamp created_at
    }

    daily_gage_candidates {
        bigserial id PK
        bigint daily_gage_id FK
        bigint forfeit_id FK
    }

    daily_gage_votes {
        bigserial id PK
        bigint candidate_id FK
        bigint user_id FK
        int vote
    }

    password_reset_tokens {
        bigserial id PK
        varchar token UK
        bigint user_id FK
        timestamp expires_at
        boolean used
        timestamp created_at
    }

    users ||--o{ groups : "crée"
    users ||--o{ group_members : "membre"
    groups ||--o{ group_members : "contient"
    matches ||--o{ bets : "sujet de"
    groups ||--o{ bets : "organise"
    users ||--o{ bets : "crée"
    bets ||--o{ bet_participations : "reçoit"
    users ||--o{ bet_participations : "participe à"
    forfeits }o--o| users : "proposé par"
    forfeits }o--o| groups : "appartient à"
    forfeits ||--o{ forfeit_votes : "reçoit"
    users ||--o{ forfeit_votes : "vote sur"
    users ||--o{ user_forfeits : "reçoit"
    forfeits ||--o{ user_forfeits : "assigné via"
    users ||--o{ user_forfeits : "assigne"
    bets }o--o{ user_forfeits : "déclenche"
    groups }o--o{ user_forfeits : "dans"
    groups ||--o{ group_forfeits : "possède"
    users }o--o| group_forfeits : "proposé par"
    groups ||--o{ group_user_forfeits : "dans"
    users ||--o{ group_user_forfeits : "reçoit"
    group_forfeits ||--o{ group_user_forfeits : "assigné via"
    users ||--o{ group_user_forfeits : "assigne"
    bets }o--o{ group_user_forfeits : "déclenche"
    groups ||--o{ daily_gages : "possède"
    forfeits }o--o| daily_gages : "sélectionné pour"
    users }o--o| daily_gages : "assigné à"
    daily_gages ||--o{ daily_gage_candidates : "propose"
    forfeits ||--o{ daily_gage_candidates : "candidat"
    daily_gage_candidates ||--o{ daily_gage_votes : "reçoit"
    users ||--o{ daily_gage_votes : "vote"
    users ||--o{ password_reset_tokens : "possède"
```

---

## Tables et descriptions

### `users` — Utilisateurs

Compte joueur sur la plateforme.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `username` | VARCHAR(50) UNIQUE | Nom d'utilisateur |
| `email` | VARCHAR(100) UNIQUE | Adresse e-mail |
| `password` | TEXT | Hash BCrypt |
| `role` | VARCHAR(20) | `PLATFORM_ADMIN` ou `USER` |
| `display_name` | VARCHAR(100) | Nom affiché (optionnel) |
| `avatar_url` | VARCHAR(255) | URL de l'avatar |
| `global_score` | INT | Score cumulé toutes compétitions |
| `bets_won` | INT | Nombre de paris gagnés |
| `forfeits_received` | INT | Nombre de gages reçus |
| `email_verified` | BOOLEAN | Vérification e-mail effectuée |
| `verification_token` | VARCHAR(255) | Token de vérification e-mail |
| `token_expiry` | TIMESTAMP | Expiration du token de vérification |
| `email_reminder_enabled` | BOOLEAN | Rappels par e-mail activés |
| `reminder_sent_date` | DATE | Date du dernier rappel envoyé |
| `email_gage_enabled` | BOOLEAN | Notifications de gage par e-mail |
| `created_at` | TIMESTAMP | Date de création |

---

### `groups` — Groupes de jeu

Groupe d'amis partageant des paris et des gages.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `name` | VARCHAR(100) | Nom du groupe |
| `description` | TEXT | Description (optionnel) |
| `invite_code` | VARCHAR(20) UNIQUE | Code d'invitation |
| `is_private` | BOOLEAN | Groupe privé (sur invitation) |
| `created_by` | BIGINT FK → users | Créateur du groupe |
| `created_at` | TIMESTAMP | Date de création |

---

### `group_members` — Membres de groupe

Table de jonction entre utilisateurs et groupes.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `group_id` | BIGINT FK → groups | Groupe |
| `user_id` | BIGINT FK → users | Utilisateur |
| `role` | VARCHAR(20) | `GROUP_ADMIN` ou `MEMBER` |
| `status` | VARCHAR(20) | `ACTIVE` ou `PENDING` |
| `joined_at` | TIMESTAMP | Date d'adhésion |

Contrainte unique : `(group_id, user_id)`

---

### `matches` — Matchs

Rencontres sportives (Coupe du Monde 2026).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `team_a` | VARCHAR(100) | Équipe domicile |
| `team_b` | VARCHAR(100) | Équipe extérieur |
| `match_date` | TIMESTAMP | Date et heure du match |
| `score_a` | INT | Score équipe A (null avant résultat) |
| `score_b` | INT | Score équipe B (null avant résultat) |
| `status` | VARCHAR(20) | `UPCOMING`, `ONGOING`, `FINISHED` |
| `competition` | VARCHAR(100) | Nom de la compétition |
| `round` | VARCHAR(100) | Tour (phase de groupes, etc.) |
| `reminder_sent` | BOOLEAN | Rappel e-mail envoyé |

---

### `bets` — Paris

Pari associé à un match et un groupe.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `title` | VARCHAR(200) | Intitulé du pari |
| `description` | TEXT | Détails (optionnel) |
| `group_id` | BIGINT FK → groups | Groupe concerné |
| `match_id` | BIGINT FK → matches | Match concerné (optionnel) |
| `creator_id` | BIGINT FK → users | Créateur du pari |
| `bet_type` | VARCHAR(20) | `SCORE`, `EVENT`, `FORFEIT`, `FREE` |
| `points` | INT | Mise en points |
| `deadline` | TIMESTAMP | Date limite pour parier |
| `status` | VARCHAR(20) | `OPEN`, `VALIDATED`, `CANCELLED` |
| `winning_option` | VARCHAR(200) | Option gagnante (après validation) |
| `created_at` | TIMESTAMP | Date de création |

Contrainte unique : `(match_id, group_id)` — un seul pari par match par groupe.

---

### `bet_participations` — Participations aux paris

Pronostic d'un joueur sur un pari.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `bet_id` | BIGINT FK → bets | Pari concerné (CASCADE DELETE) |
| `user_id` | BIGINT FK → users | Joueur |
| `chosen_option` | VARCHAR(200) | Option choisie |
| `comment` | TEXT | Commentaire (optionnel) |
| `points_earned` | INT | Points gagnés après validation |
| `created_at` | TIMESTAMP | Date de participation |

Contrainte unique : `(bet_id, user_id)`

---

### `forfeits` — Gages partagés

Gage global ou appartenant à un groupe, pouvant être assigné aux perdants.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `title` | VARCHAR(200) | Intitulé du gage |
| `description` | TEXT | Description |
| `category` | VARCHAR(100) | Catégorie (ex: General) |
| `is_active` | BOOLEAN | Gage disponible pour assignation |
| `times_completed` | INT | Nombre de fois accompli |
| `proposed_by_id` | BIGINT FK → users | Proposé par (null = créé par admin) |
| `group_id` | BIGINT FK → groups | Groupe propriétaire (null = partagé) |

---

### `forfeit_votes` — Votes sur les gages

Vote d'approbation / rejet d'un gage partagé par un joueur.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `forfeit_id` | BIGINT FK → forfeits | Gage voté (CASCADE DELETE) |
| `user_id` | BIGINT FK → users | Votant (CASCADE DELETE) |
| `vote` | INT | `+1` (pour) ou `-1` (contre) |

Contrainte unique : `(forfeit_id, user_id)`

---

### `user_forfeits` — Gages assignés (global)

Association entre un joueur et un gage partagé qui lui a été attribué.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `user_id` | BIGINT FK → users | Joueur qui reçoit le gage |
| `forfeit_id` | BIGINT FK → forfeits | Gage concerné |
| `assigned_by_id` | BIGINT FK → users | Joueur qui assigne le gage |
| `bet_id` | BIGINT FK → bets | Pari déclencheur (optionnel) |
| `group_id` | BIGINT FK → groups | Groupe concerné (optionnel) |
| `is_completed` | BOOLEAN | Gage accompli |
| `completed_at` | TIMESTAMP | Date d'accomplissement |
| `assigned_at` | TIMESTAMP | Date d'assignation |

---

### `group_forfeits` — Gages de groupe

Catalogue de gages propre à un groupe (distinct des gages partagés).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `group_id` | BIGINT FK → groups | Groupe propriétaire (CASCADE DELETE) |
| `title` | VARCHAR(200) | Intitulé du gage |
| `description` | TEXT | Description |
| `category` | VARCHAR(100) | Catégorie |
| `is_active` | BOOLEAN | Gage disponible pour assignation |
| `times_completed` | INT | Nombre de fois accompli |
| `proposed_by_id` | BIGINT FK → users | Proposé par (null = créé par admin) |
| `created_at` | TIMESTAMP | Date de création |

---

### `group_user_forfeits` — Gages assignés dans un groupe

Association entre un joueur et un gage de groupe qui lui a été attribué.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `group_id` | BIGINT FK → groups | Groupe concerné (CASCADE DELETE) |
| `user_id` | BIGINT FK → users | Joueur qui reçoit le gage |
| `forfeit_id` | BIGINT FK → group_forfeits | Gage de groupe concerné |
| `assigned_by_id` | BIGINT FK → users | Joueur qui assigne le gage |
| `bet_id` | BIGINT FK → bets | Pari déclencheur (optionnel) |
| `is_completed` | BOOLEAN | Gage accompli |
| `completed_at` | TIMESTAMP | Date d'accomplissement |
| `assigned_at` | TIMESTAMP | Date d'assignation |

---

### `daily_gages` — Gages du jour

Gage quotidien attribué au perdant du jour dans un groupe.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `group_id` | BIGINT FK → groups | Groupe concerné |
| `match_date` | DATE | Date du jour |
| `forfeit_id` | BIGINT FK → forfeits | Gage sélectionné (null jusqu'à sélection) |
| `mode` | VARCHAR(20) | `DIRECT` (admin choisit) ou `VOTE` (vote du groupe) |
| `status` | VARCHAR(20) | `PENDING`, `ACTIVE`, `SETTLED` |
| `assigned_to_id` | BIGINT FK → users | Joueur perdant du jour |
| `assigned_at` | TIMESTAMP | Date d'assignation |
| `created_at` | TIMESTAMP | Date de création |

Contrainte unique : `(group_id, match_date)` — un seul gage par jour par groupe.

---

### `daily_gage_candidates` — Candidats au gage du jour

Gages en lice lors d'un vote pour le gage du jour.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `daily_gage_id` | BIGINT FK → daily_gages | Gage du jour concerné (CASCADE DELETE) |
| `forfeit_id` | BIGINT FK → forfeits | Gage candidat |

Contrainte unique : `(daily_gage_id, forfeit_id)`

---

### `daily_gage_votes` — Votes pour le gage du jour

Vote d'un joueur pour un candidat au gage du jour.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `candidate_id` | BIGINT FK → daily_gage_candidates | Candidat voté (CASCADE DELETE) |
| `user_id` | BIGINT FK → users | Votant |
| `vote` | INT | `+1` (pour) ou `-1` (contre) |

Contrainte unique : `(candidate_id, user_id)`

---

### `password_reset_tokens` — Tokens de réinitialisation

Tokens à usage unique pour la réinitialisation de mot de passe.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL PK | Identifiant unique |
| `token` | VARCHAR(36) UNIQUE | Token UUID |
| `user_id` | BIGINT FK → users | Utilisateur concerné (CASCADE DELETE) |
| `expires_at` | TIMESTAMP | Date d'expiration |
| `used` | BOOLEAN | Token déjà utilisé |
| `created_at` | TIMESTAMP | Date de création |

---

## Énumérations

| Enum | Valeurs | Utilisé dans |
|------|---------|--------------|
| `UserRole` | `PLATFORM_ADMIN`, `USER` | `users.role` |
| `GroupMemberRole` | `GROUP_ADMIN`, `MEMBER` | `group_members.role` |
| `GroupMemberStatus` | `ACTIVE`, `PENDING` | `group_members.status` |
| `MatchStatus` | `UPCOMING`, `ONGOING`, `FINISHED` | `matches.status` |
| `BetType` | `SCORE`, `EVENT`, `FORFEIT`, `FREE` | `bets.bet_type` |
| `BetStatus` | `OPEN`, `VALIDATED`, `CANCELLED` | `bets.status` |
| `DailyGageMode` | `DIRECT`, `VOTE` | `daily_gages.mode` |
| `DailyGageStatus` | `PENDING`, `ACTIVE`, `SETTLED` | `daily_gages.status` |

---

## Évolution du schéma (Flyway)

Les migrations sont dans `backend/src/main/resources/db/migration/`.

| Version | Description |
|---------|-------------|
| V1 | Schéma initial : `users`, `matches`, `bets`, `bet_participations`, `forfeits`, `user_forfeits` |
| V2–V3 | Données de démo, correctifs mots de passe |
| V4 | Ajout `matches.forfeit_id` et `bettor_bonus` (supprimés en V9/V19) |
| V5–V6 | Données de démo supplémentaires, correctifs |
| V7 | Score de départ de 10 points (revert en V11) |
| V8 | Contrainte un-pari-par-match (`uq_bets_match_id`) |
| V9 | Système de gage quotidien : `daily_gages`, `daily_gage_candidates`, `daily_gage_votes` ; suppression `matches.forfeit_id` |
| V10 | Nettoyage des `daily_gages` orphelins (sans match correspondant) |
| V11 | Suppression du score de départ (10 pts) |
| V12 | Gestion des groupes : `groups`, `group_members` |
| V13 | Gages et gages utilisateur par groupe : `group_forfeits`, `group_user_forfeits` ; portée groupe sur `bets` et `daily_gages` |
| V14 | Seed du groupe initial et gages de groupe |
| V15 | Confidentialité des groupes (`is_private`) ; statut des membres (`ACTIVE`/`PENDING`) |
| V16 | Contrainte un-pari-par-(match, groupe) |
| V17 | `forfeits.group_id` — gages partagés ou appartenant à un groupe |
| V18 | Contrainte un-gage-du-jour-par-(groupe, date) |
| V19 | `user_forfeits.group_id` pour le classement par groupe ; suppression de `bettor_bonus` |
| V20 | Migration du rôle `ADMIN` → `PLATFORM_ADMIN` |
| V21 | `users.display_name` |
| V22–V23 | `forfeit_votes` : votes sur les gages partagés |
| V24 | Vérification e-mail : `email_verified`, `verification_token`, `token_expiry` |
| V25 | `password_reset_tokens` |
| V26 | `users.email_reminder_enabled`, `matches.reminder_sent` |
| V27 | `users.reminder_sent_date` |
| V28 | Seed du groupe GU |
| V29 | `users.email_gage_enabled` |
