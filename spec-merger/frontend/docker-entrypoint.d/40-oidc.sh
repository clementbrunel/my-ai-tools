#!/bin/sh
# Sélectionne la variante nginx selon OIDC_ENABLED et publie /config.json pour le frontend.
# Variables : OIDC_ENABLED (true|false, défaut false), OAUTH2_PROXY_URL (défaut
# http://oauth2-proxy:4180), OIDC_LOGOUT_REDIRECT (URL de fin de session Keycloak, optionnelle).
set -eu

dest=/etc/nginx/conf.d
if [ "${OIDC_ENABLED:-false}" = "true" ]; then
  variant=/etc/nginx/oidc-on
  enabled=true
else
  variant=/etc/nginx/oidc-off
  enabled=false
fi

proxy_url="${OAUTH2_PROXY_URL:-http://oauth2-proxy:4180}"
for part in server page api; do
  sed "s|OAUTH2_PROXY_URL|$proxy_url|g" "$variant/$part.inc" > "$dest/oidc-$part.inc"
done

# Échappe \ et " pour rester du JSON valide.
logout=$(printf '%s' "${OIDC_LOGOUT_REDIRECT:-}" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{"oidcEnabled":%s,"logoutRedirect":"%s"}\n' "$enabled" "$logout" > "$dest/app-config.json"
echo "40-oidc.sh: OIDC_ENABLED=$enabled"
