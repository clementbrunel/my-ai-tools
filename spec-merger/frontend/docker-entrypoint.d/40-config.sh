#!/bin/sh
# Publie /config.json pour le frontend (lu au chargement de la page, pas dans le bundle).
# Variables : OIDC_ENABLED (true|false, défaut false) — l'app tourne derrière un proxy qui gère le login,
# le frontend affiche alors le bouton « Se déconnecter » ; OIDC_LOGOUT_REDIRECT (URL de fin de session
# Keycloak, optionnelle).
set -eu

if [ "${OIDC_ENABLED:-false}" = "true" ]; then enabled=true; else enabled=false; fi

# Échappe \ et " pour rester du JSON valide.
logout=$(printf '%s' "${OIDC_LOGOUT_REDIRECT:-}" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{"oidcEnabled":%s,"logoutRedirect":"%s"}\n' "$enabled" "$logout" > /etc/nginx/conf.d/app-config.json
echo "40-config.sh: OIDC_ENABLED=$enabled"
