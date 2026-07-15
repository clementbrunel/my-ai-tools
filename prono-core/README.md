# Prono Core ⚽🏆

**Application de pronostics entre amis — Coupe du Monde 2026 ⚽ et Formule 1 🏎 — Pas d'argent réel, que du fun et des gages !**

## Stack technique

| Couche | Techno |
|--------|--------|
| Backend | Java 21 + Spring Boot 3 + Spring Security JWT |
| Base de données | PostgreSQL 16 + Flyway |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Déploiement | Docker Compose (dev) / Registry Docker privé (prod) |

---

## Lancement rapide (développement local)

### Prérequis
- Docker + Docker Compose installés

### Démarrage

```bash
cd prono-core
docker compose up --build
```

L'application sera accessible sur :
- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:8090
- **Swagger UI** : http://localhost:8090/swagger-ui.html

### Comptes de démo

Les comptes de démo sont créés par la migration Flyway `V2__demo_data.sql`.
Consulte ce fichier pour les identifiants (ne pas les exposer publiquement).

---

## Accès à la base de données (pgAdmin)

pgAdmin est disponible pour inspecter ou modifier directement les données.

### En développement local

pgAdmin démarre automatiquement avec `docker compose up` :

- **URL** : http://localhost:5050
- **Email** : `admin@local.dev` (ou `PGADMIN_EMAIL`)
- **Mot de passe** : `admin` (ou `PGADMIN_PASSWORD`)

Connexion à configurer dans pgAdmin :

| Champ | Valeur |
|-------|--------|
| Host | `postgres` |
| Port | `5432` |
| Database | `pronocore` |
| Username | valeur de `DB_USER` |
| Password | valeur de `DB_PASS` |

### En production

pgAdmin n'est **pas démarré par défaut**. Pour l'activer ponctuellement :

```bash
docker compose -f docker-compose.prod.yml --profile tools up -d pgadmin
```

Accessible sur http://&lt;HOST&gt;:5050 — **penser à le couper une fois terminé** :

```bash
docker compose -f docker-compose.prod.yml --profile tools stop pgadmin
```

---

## Déploiement production

Le déploiement repose sur un registry Docker privé.
Les images sont buildées en local et poussées vers le registry — **aucune compilation sur le serveur de prod**.

### Prérequis (une seule fois)

- Registry Docker privé accessible depuis ta machine de dev
- Variable `REGISTRY` définie (ex: `export REGISTRY=myregistry:5000`)
- `docker-compose.prod.yml` et un fichier `.env` déposés sur le serveur de prod

### Déployer une nouvelle version

**Depuis ta machine de dev :**

```bash
cd prono-core
export REGISTRY=myregistry:5000
./build-and-push.sh          # build + push backend & frontend
# optionnel : ./build-and-push.sh v1.2.0  pour tagger une version spécifique
```

**Sur le serveur de prod :**

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Fichiers

| Fichier | Usage |
|---------|-------|
| `docker-compose.yml` | Dev local (build à la volée) |
| `docker-compose.prod.yml` | Production (images pré-buildées) |
| `build-and-push.sh` | Build + push vers le registry privé |
| `.env.example` | Template des variables d'environnement |

---

## Développement local

### Backend

```bash
cd backend

# Démarrer uniquement PostgreSQL
docker compose -f ../docker-compose.yml up postgres -d

# Lancer le backend
./mvnw spring-boot:run
# ou
mvn spring-boot:run
```

Le backend écoute sur http://localhost:8080

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend écoute sur http://localhost:5173 avec proxy vers le backend.

---

## Architecture

```
prono-core/
├── docker-compose.yml
├── docs/
│   └── data-model.md             # Modèle de données (ERD + descriptions des tables)
├── backend/
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/pronocore/   # config, controller, dto, entity, service...
│       └── resources/db/migration/  # Flyway SQL migrations
└── frontend/
    ├── Dockerfile
    └── src/                      # api, components, context, pages, types
```

### Modèle de données

Le schéma complet (ERD Mermaid + description des 13 tables) est documenté dans [`docs/data-model.md`](docs/data-model.md).

Tables principales : `users`, `groups`, `group_members`, `matches`, `bets`, `bet_participations`, `forfeits`, `forfeit_votes`, `user_forfeits`, `daily_gages`, `daily_gage_candidates`, `daily_gage_votes`, `password_reset_tokens`.

---

## Fonctionnalités

- Inscription / Connexion JWT, profil avec stats, classement
- Paris par couple **(match, groupe)** — 4 types : Score exact, Événement, Gage, Libre
- Gages partagés (admin global) et gages de groupe (privés)
- Attribution automatique des gages aux perdants à la validation
- Interface admin : créer des matchs, saisir les scores, valider les paris

Documentation API complète : http://localhost:8090/swagger-ui.html

---

## Barème des points

Le scoring est **additif** : chaque élément correct rapporte des points indépendamment.

### Match normal (phase de groupes)

| Prédiction | Points |
|---|:---:|
| Bon gagnant + bon score | **5** |
| Bon gagnant, mauvais score | **3** |
| Mauvais gagnant | **0** |

### Match avec tirs au but — TAB (phase éliminatoire)

| Prédiction | Points |
|---|:---:|
| Bon gagnant + bon score réglementaire + bon score pénalty | **7** |
| Bon gagnant + bon score réglementaire | **5** |
| Bon gagnant, mauvais score réglementaire | **3** |
| Mauvais gagnant, bon score réglementaire | **2** |
| Mauvais gagnant | **0** |

> Le score réglementaire est le score nul à l'issue des prolongations (ex. 1-1) qui déclenche les tirs au but.
> Le score pénalty n'est pris en compte que si l'administrateur l'a saisi lors de la validation du match.

---

### Grand Prix F1 — formule « Podium + » (additif, max 14)

| Pick | Points | Verrou |
|---|:---:|---|
| P1 / P2 / P3 exacts | **3 / 2 / 2** | Départ course |
| Pilote sur le podium, mauvaise marche | **1** | Départ course |
| Pole position | **2** | Début des qualifs |
| Meilleur tour | **1** | Départ course |
| Lanterne rouge (dernier classé) | **2** | Départ course |
| Bonus Grand Chelem (pole + P1 + meilleur tour) | **+2** | — |

> Saisie par drag & drop de mini-F1 aux couleurs des écuries. Les groupes
> choisissent leurs sports (⚽ / 🏎) ; classement du groupe filtrable par sport.

---

## Configuration

Variables d'environnement (backend) :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `DB_URL` | `jdbc:postgresql://localhost:5432/pronocore` | URL PostgreSQL |
| `DB_USER` | `pronocore` | Utilisateur DB |
| `DB_PASS` | `pronocore` | Mot de passe DB |
| `JWT_SECRET` | `mySecretKey...` | Clé secrète JWT (changer en prod !) |

---

## Notes importantes

- **Aucun argent réel** — Ce projet est uniquement à des fins de fun entre amis
- Les mots de passe sont hashés avec BCrypt
- Les tokens JWT expirent après 24h
- En production, changez `JWT_SECRET` pour une vraie clé sécurisée

---

*Bonne Coupe du Monde 2026 ! 🌍⚽🏆*
