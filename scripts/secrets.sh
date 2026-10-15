#!/usr/bin/env bash
# Chiffrement/déchiffrement des secrets de ce repo avec sops + age.
# Voir docs/secrets.md pour la mise en place (génération de clé, .sops.yaml).
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/secrets.sh encrypt-env <tool-dir>     <tool-dir>/.env -> <tool-dir>/.env.enc
  scripts/secrets.sh decrypt-env <tool-dir>     <tool-dir>/.env.enc -> <tool-dir>/.env
  scripts/secrets.sh encrypt-file <path>        <path> -> <path>.age (fichier binaire, ex: clé PEM)
  scripts/secrets.sh decrypt-file <path>.age    <path>.age -> <path>

Requiert `sops` et `age` installés. Déchiffrement : clé privée dans
$SOPS_AGE_KEY_FILE, ou par défaut ~/.config/sops/age/keys.txt (emplacement
standard de sops/age-keygen).
EOF
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
default_key_file="${HOME:-}/.config/sops/age/keys.txt"

cmd="${1:-}"
case "$cmd" in
  encrypt-env)
    dir="${2:?tool directory required}"
    sops --encrypt "$dir/.env" > "$dir/.env.enc"
    ;;
  decrypt-env)
    dir="${2:?tool directory required}"
    sops --decrypt "$dir/.env.enc" > "$dir/.env"
    ;;
  encrypt-file)
    path="${2:?file path required}"
    recipient="$(awk -F': ' '/^[[:space:]]*age:/{print $2; exit}' "$repo_root/.sops.yaml")"
    if [ -z "$recipient" ] || [ "$recipient" = "AGE_PUBLIC_KEY_REPLACE_ME" ]; then
      echo "Pas de clé age configurée dans .sops.yaml — voir docs/secrets.md." >&2
      exit 1
    fi
    age -e -r "$recipient" -o "$path.age" "$path"
    ;;
  decrypt-file)
    path="${2:?encrypted file path required (<file>.age)}"
    out="${path%.age}"
    age -d -i "${SOPS_AGE_KEY_FILE:-$default_key_file}" -o "$out" "$path"
    ;;
  *)
    usage
    exit 1
    ;;
esac
