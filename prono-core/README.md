# Prono Core ⚽🏆

**Application de pronostics Coupe du Monde 2026 entre amis — Pas d'argent réel, que du fun et des gages !**

## Stack technique

| Couche | Techno |
|--------|--------|
| Backend | Java 21 + Spring Boot 3 + Spring Security JWT |
| Base de données | PostgreSQL 16 + Flyway |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Déploiement | Docker Compose (dev) / Registry NAS Synology (prod) |

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

## Déploiement production (NAS Synology)

Le déploiement repose sur un registry Docker privé tournant sur le NAS (`192.168.68.112:5000`).
Les images sont buildées en local et poussées sur le NAS — **aucune compilation sur le NAS**.

### Prérequis (une seule fois)

- Registry `registry:2` lancé sur le NAS via Container Manager
- `192.168.68.112:5000` déclaré comme insecure registry dans Docker Desktop
- `docker-compose.prod.yml` et un fichier `.env` copiés sur le NAS dans le même dossier

### Déployer une nouvelle version

**Depuis ta machine de dev :**

```bash
cd prono-core
./build-and-push.sh          # build + push backend & frontend sur le NAS
# optionnel : ./build-and-push.sh v1.2.0  pour tagger une version spécifique
```

**Sur le NAS (SSH ou tâche planifiée) :**

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Fichiers

| Fichier | Usage |
|---------|-------|
| `docker-compose.yml` | Dev local (build à la volée) |
| `docker-compose.prod.yml` | Production NAS (images pré-buildées) |
| `build-and-push.sh` | Build + push vers le registry NAS |
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
├── backend/
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/
│       ├── main/java/com/pronocore/
│       │   ├── config/          # SecurityConfig, OpenApiConfig
│       │   ├── controller/      # REST controllers
│       │   ├── dto/             # Request/Response DTOs
│       │   ├── entity/          # JPA entities
│       │   ├── mapper/          # MapStruct mappers
│       │   ├── repository/      # Spring Data repositories
│       │   ├── security/        # JWT provider & filter
│       │   └── service/         # Business logic
│       └── main/resources/
│           ├── application.yml
│           └── db/migration/    # Flyway SQL migrations
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── api/                 # Axios API calls
        ├── components/          # Reusable React components
        ├── context/             # AuthContext (JWT)
        ├── pages/               # Full page components
        └── types/               # TypeScript interfaces
```

---

## Fonctionnalités

### Utilisateurs
- Inscription / Connexion (JWT)
- Profil avec stats (points, paris gagnés, gages reçus)
- Classement général

### Matchs
- Liste des matchs (filtres: à venir / en cours / terminés)
- Détail d'un match avec ses paris
- Création / mise à jour du score (Admin)

### Paris
- Un pari appartient à un couple **(match, groupe)**
- Un match est global mais **fermé aux paris** par défaut ; l'**admin du groupe** l'ouvre aux paris pour son groupe (0, 1 ou N paris selon les groupes qui l'ont ouvert)
- 4 types: Score exact, Événement, Gage, Libre
- Participation réservée aux **membres actifs** du groupe (pronostic + commentaire)
- Le résultat saisi par l'admin règle les paris de **tous** les groupes concernés
- Attribution automatique de gages aux perdants (type FORFEIT)

### Gages
- Catalogue de gages fun (maillot adverse, chanson, photo ridicule...)
- **Gages partagés** (créés par l'admin, visibles par tous les groupes) + **gages de groupe** (ajouts des joueurs, privés à leur groupe)
- Attribution manuelle (Admin) ou automatique à la validation
- Suivi de completion

### Classement
- Podium top 3
- Badge "Roi des gages" 🃏 (plus de gages reçus)
- Badge "Pire loser" 💀

### Admin
- Créer des matchs
- Mettre à jour les scores en direct
- Valider ou annuler des paris
- Gérer les gages

---

## API Endpoints

| Méthode | URL | Description |
|---------|-----|-------------|
| POST | /api/auth/login | Connexion |
| POST | /api/auth/register | Inscription |
| GET | /api/matches | Liste des matchs |
| GET | /api/matches/{id} | Détail d'un match |
| POST | /api/matches | Créer un match (Admin) |
| PATCH | /api/matches/{id}/score | Mettre à jour le score (Admin) |
| GET | /api/bets | Paris des groupes de l'utilisateur |
| POST | /api/bets/open | Ouvrir un match aux paris dans un groupe (Admin de groupe) |
| POST | /api/bets | Créer un pari personnalisé (Admin de groupe) |
| POST | /api/bets/{id}/participate | Participer à un pari (membre du groupe) |
| POST | /api/bets/{id}/validate | Valider un pari (Admin) |
| GET | /api/leaderboard | Classement |
| GET | /api/forfeits | Liste des gages |

Voir la documentation complète sur http://localhost:8080/swagger-ui.html

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
