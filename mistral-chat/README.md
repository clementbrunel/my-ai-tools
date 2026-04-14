# mistral-chat

Interactive CLI REPL to chat with an enterprise Mistral instance from the terminal, authenticating via your existing Chrome or Edge browser session.

> **⚠️ Avertissement** : Cet outil réutilise votre session navigateur pour accéder à l'instance Mistral d'entreprise. Il est destiné à un usage personnel/PoC. Vérifiez que cet usage est conforme à la politique interne de votre organisation avant de l'utiliser en dehors d'un contexte de développement.

## Configuration

Copier `.env` et renseigner les URLs de votre instance :

```bash
cp .env .env.local  # ou éditer .env directement
```

```env
CHAT_MISTRAL_URL=https://chat.votre-instance.example.com
AUTH_MISTRAL_URL=https://auth.votre-instance.example.com
```

## Prérequis

- Node.js 22+
- Chrome ou Edge installé sur Windows
- Être connecté à l'URL configurée dans `CHAT_MISTRAL_URL` dans le navigateur (session active)

## Installation

```bash
cd mistral-chat
npm install
npm run build
```

## Usage

```bash
npm start
# ou après installation globale :
mistral-chat
```

### Commandes REPL

| Commande | Description |
|---|---|
| `/list` | Lister les conversations récentes |
| `/new [titre]` | Créer une nouvelle conversation |
| `/resume <id>` | Reprendre une conversation existante |
| `/help` | Afficher l'aide |
| `/exit` ou Ctrl+C | Quitter |

Tout texte qui ne commence pas par `/` est envoyé comme message dans la conversation active.

## Fonctionnement

1. Lit les cookies de session depuis la base SQLite de Chrome/Edge (`%LOCALAPPDATA%/Google/Chrome/User Data/Default/Network/Cookies`)
2. Déchiffre les valeurs avec la clé maître Windows DPAPI + AES-256-GCM
3. Injecte les cookies dans les requêtes HTTP vers `$CHAT_MISTRAL_URL/api/`

## Auth manuelle via `--cookie` (recommandé si Chrome est verrouillé)

L'instance utilise **Keycloak SSO** (`AUTH_MISTRAL_URL`). Il faut inclure les cookies des **deux** domaines :

1. DevTools (F12) → **Application** → **Cookies**
2. Copier les cookies de `CHAT_MISTRAL_URL` **ET** `AUTH_MISTRAL_URL`
3. Les coller tous ensemble, séparés par `;`

```bash
npm start -- --cookie "session=abc; AUTH_SESSION_ID=def; KC_RESTART=ghi; ..."
```

> Note : le proxy Keycloak vérifie `AUTH_SESSION_ID` et `KC_RESTART` même sur les requêtes vers `CHAT_MISTRAL_URL`.

## Troubleshooting

- **"Restart login cookie not found"** : ajoute `AUTH_SESSION_ID` et `KC_RESTART` depuis `AUTH_MISTRAL_URL` dans `--cookie`
- **"Aucun cookie trouvé"** : Chrome verrouille son fichier Cookies — utilise `--cookie` (voir ci-dessus)
- **"Session expirée / 401"** : reconnecte-toi dans le navigateur puis relance l'outil
- **"Erreur DPAPI"** : assure-toi de lancer l'outil sous le même utilisateur Windows que le navigateur

## Options CLI

```text
mistral-chat [options]

Options:
  --cookie <string>  Cookie header complet (CHAT_MISTRAL_URL + AUTH_MISTRAL_URL)
  --bearer <token>   Bearer JWT (si l'API utilise Authorization: Bearer)
  --profile <name>   Profil Chrome/Edge à utiliser (défaut: Default)
  --browser <name>   Navigateur cible : chrome | edge (défaut: chrome)
  --debug            Afficher les requêtes HTTP brutes
  -V, --version      Afficher la version
  -h, --help         Afficher l'aide
```
