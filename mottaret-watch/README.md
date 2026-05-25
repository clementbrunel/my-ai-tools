# 🏔️ Surveillance disponibilités – Méribel Mottaret Les Bleuets

Vérifie automatiquement toutes les **6 heures** les logements disponibles sur :
- [meribel-mottaret-lesbleuets.fr/locations](https://meribel-mottaret-lesbleuets.fr/locations) — site officiel
- [maeva.com](https://www.maeva.com) — semaines 16-22/07 et 23-29/07

Période ciblée : **16 juillet – 31 juillet 2026**.

---

## Configuration GitHub Actions (secrets)

Dans le dépôt → **Settings → Secrets and variables → Actions** → *New repository secret* :

| Nom du secret   | Valeur                                          |
|-----------------|-------------------------------------------------|
| `RESEND_API_KEY` | Clé API [resend.com](https://resend.com)       |
| `NOTIFY_EMAIL`   | Email de destination (ex: hasto88@gmail.com)  |

---

## Test en local

### 1. Installer les dépendances

```bash
pip install requests beautifulsoup4
```

### 2. Définir les variables d'environnement

**Linux / macOS :**
```bash
export RESEND_API_KEY="re_xxxxxxxxxxxx"
export NOTIFY_EMAIL="hasto88@gmail.com"
```

**Windows (PowerShell) :**
```powershell
$env:RESEND_API_KEY = "re_xxxxxxxxxxxx"
$env:NOTIFY_EMAIL   = "hasto88@gmail.com"
```

### 3. Lancer le script

```bash
python check_availability.py
```

### 4. Tester sans envoyer d'email

Pour tester sans configurer Resend, omets `RESEND_API_KEY` — le script affiche les résultats dans le terminal et indique "⚠️ RESEND_API_KEY non configurée".

---

## Fonctionnement

- Scrape le tableau HTML du site officiel Les Bleuets (logements avec dates chevauchant 16/07–31/07)
- Appelle l'API Maeva pour 2 semaines (16-22/07 et 23-29/07) — résultats informatifs
- Compare avec le cache `last_results.json` (commité automatiquement par GitHub Actions)
- **Email envoyé uniquement si** : disponibilités trouvées ET nouvelles annonces depuis la dernière vérification (ou première exécution)
- Cron : `0 4,10,16,22 * * *` UTC = **6h, 12h, 18h, 0h** heure Paris (été)

---

## Déclencher manuellement

GitHub → **Actions** → *Surveillance Méribel Mottaret* → **Run workflow**
