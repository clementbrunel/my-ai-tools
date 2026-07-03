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

### 3. Construire l'image

```bash
docker compose build
```

### 4. Tester un premier run

```bash
docker compose run --rm mottaret-watch
```

Le cache est persisté dans le volume Docker nommé `mottaret-data` (géré automatiquement).

Pour réinitialiser le cache (repart de zéro, renvoie un email complet au prochain run) :

```bash
docker volume rm mottaret-watch_mottaret-data
```

### 5. Planifier toutes les heures

Dans **Synology Task Scheduler** → Tâche déclenchée → Script utilisateur :

```bash
cd /volume1/scripts/mottaret-watch && docker compose run --rm mottaret-watch
```

Fréquence : toutes les heures.

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
