# 🏔️ Surveillance disponibilités – Méribel Mottaret Les Bleuets

Vérifie automatiquement toutes les **6 heures** les logements disponibles  
sur [meribel-mottaret-lesbleuets.fr/locations](https://meribel-mottaret-lesbleuets.fr/locations)  
pour la période **16 juillet – 31 juillet 2026**.

## Installation (5 minutes)

### 1. Créer le dépôt GitHub

```bash
gh repo create mottaret-watch --private --source=. --push
```

### 2. Configurer les secrets GitHub

Dans votre dépôt → **Settings → Secrets and variables → Actions** → *New repository secret* :

| Nom du secret  | Valeur |
|----------------|--------|
| `SMTP_USER`     | Votre adresse Gmail (ex: vous@gmail.com) |
| `SMTP_PASSWORD` | [Mot de passe d'application Gmail](https://myaccount.google.com/apppasswords) (**pas** votre vrai mdp) |
| `NOTIFY_EMAIL`  | Email de destination (hasto88@gmail.com) |
| `SMTP_HOST`     | `smtp.gmail.com` *(optionnel, c'est la valeur par défaut)* |
| `SMTP_PORT`     | `587` *(optionnel, c'est la valeur par défaut)* |

> **Mot de passe d'application Gmail** : allez sur  
> https://myaccount.google.com/apppasswords  
> Sélectionnez "Autre" → donnez un nom (ex: "Mottaret Watch") → copiez le code à 16 caractères.

### 3. Activer les Actions GitHub

Dans votre dépôt → **Actions** → Cliquer sur "I understand my workflows, go ahead and enable them".

### 4. Test manuel immédiat

Dans votre dépôt → **Actions** → *Surveillance Méribel Mottaret* → **Run workflow**.

---

## Fonctionnement

- Le script `check_availability.py` est lancé 4 fois par jour (6h, 12h, 18h, 0h, heure de Paris).
- Il compare les résultats avec la vérification précédente (`last_results.json`).
- **Un email n'est envoyé que si** :
  - des logements sont disponibles sur 16/07–31/07 **ET**
  - il y a de nouvelles annonces depuis la dernière vérification (ou c'est la première exécution).
- L'historique des résultats est commité automatiquement dans `last_results.json`.

## Utilisation locale

```bash
pip install -r requirements.txt

# Variables d'environnement
export SMTP_USER="vous@gmail.com"
export SMTP_PASSWORD="xxxx xxxx xxxx xxxx"
export NOTIFY_EMAIL="hasto88@gmail.com"

python check_availability.py
```
