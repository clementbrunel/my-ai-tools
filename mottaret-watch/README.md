# 🏔️ Surveillance disponibilités – Méribel Mottaret Les Bleuets

Vérifie toutes les **heures** les logements disponibles sur :
- [meribel-mottaret-lesbleuets.fr/locations](https://meribel-mottaret-lesbleuets.fr/locations) — site officiel
- [maeva.com](https://www.maeva.com) — semaines 16-22/07 et 23-29/07

Période ciblée : **16 juillet – 31 juillet 2026**.

---

## Déploiement sur Synology (Docker)

Le script tourne dans un container Docker déclenché toutes les heures par le **Task Scheduler** du Synology.

### 1. Copier les fichiers sur le NAS

```
mottaret-watch/
├── check_availability.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env          ← à créer à partir de .env.example
```

### 2. Créer le fichier `.env`

```bash
cp .env.example .env
# puis éditer .env avec ta vraie RESEND_API_KEY
```

### 3. Construire l'image et créer le container

```bash
docker compose build
docker compose create
```

`create` crée le container **une seule fois**, sans le démarrer. C'est ce même container (nommé `mottaret-watch`) qui sera redémarré à chaque exécution planifiée — il n'est plus recréé toutes les heures, donc ses logs (`docker logs`) restent consultables même après un crash.

### 4. Tester un premier run

```bash
docker start -a mottaret-watch
```

Le cache est persisté dans le volume Docker nommé `mottaret-data` (géré automatiquement).

Pour réinitialiser le cache (repart de zéro, renvoie un email complet au prochain run) :

```bash
docker volume rm mottaret-watch_mottaret-data
```

### 5. Planifier toutes les heures

Dans **Synology Task Scheduler** → Tâche déclenchée → Script utilisateur :

```bash
docker start -a mottaret-watch
```

Fréquence : toutes les heures.

`docker start -a` démarre le container existant et attend qu'il se termine (comportement bloquant identique à l'ancien `docker compose run --rm`), mais **sans le détruire** à la fin. Le code de sortie du script (0 si OK, ≠0 si crash) reste répercuté normalement, donc Container Manager continue de signaler un vrai crash.

### 6. Consulter les logs

```bash
docker logs mottaret-watch          # historique complet (toutes les exécutions passées)
docker logs -f mottaret-watch       # suivre en direct
docker logs --since 24h mottaret-watch
```

Les logs sont conservés par Docker avec rotation automatique (5 fichiers de 10 Mo max, voir `docker-compose.yml`), donc plus besoin d'aller chercher un container éphémère qui a disparu.

### 7. Déployer une mise à jour du script

Comme le container n'est plus recréé à chaque run, un changement de code nécessite de le recréer explicitement pour qu'il utilise la nouvelle image :

```bash
docker compose build
docker compose up --no-start --force-recreate mottaret-watch
```

⚠️ Recréer le container repart avec des logs vides (nouvel ID de container) — le cache, lui, n'est pas affecté car il vit dans le volume `mottaret-data`, séparé du container.

---

## Fonctionnement

- Scrape le tableau HTML du site officiel Les Bleuets (logements chevauchant 16/07–31/07)
- Ouvre une session Maeva, extrait le CSRF token depuis la page de la résidence, puis interroge l'API pour 2 semaines (16-22/07 et 23-29/07) — chaque semaine est une entrée distincte avec son propre prix
- Compare avec le cache JSON persisté entre les runs
- **Email envoyé uniquement si** : disponibilités trouvées ET nouvelles annonces ou changements depuis la dernière vérification (ou première exécution)
- Si l'API Maeva est indisponible : une seule alerte email, pas de spam à chaque run

---

## Test en local (sans Docker)

```bash
pip install requests beautifulsoup4
export RESEND_API_KEY="re_xxxxxxxxxxxx"
python check_availability.py
```

Sans `RESEND_API_KEY`, le script affiche les résultats dans le terminal sans envoyer d'email.
