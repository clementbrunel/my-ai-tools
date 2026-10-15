# Secrets : chiffrement avec sops + age

Les apps déployées de ce repo (`prono-core`, `my-money-hub`, `spec-merger`,
`mottaret-watch`) tournent sur un NAS avec un `.env` par app, jamais committé
(`.gitignore`). En cas de perte du NAS, ces `.env` sont perdus sans copie
versionnée. Ce qui suit permet de committer une version chiffrée à côté de
chaque `.env.example`, pour pouvoir reconstruire un déploiement avec
juste : clone du repo + une clé privée gardée hors Git.

`my-house` n'est pas concerné : c'est encore une idée, pas un déploiement réel.

## 1. Installer les outils

- [`age`](https://github.com/FiloSottile/age) — chiffrement par clé
- [`sops`](https://github.com/getsops/sops) — chiffre un `.env` valeur par
  valeur (diff Git lisible), en s'appuyant sur `age`

## 2. Générer sa clé (une seule fois)

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

- **Clé privée** (`~/.config/sops/age/keys.txt`) : à sauvegarder dans un
  gestionnaire de mots de passe (Bitwarden, 1Password...) + une copie
  offline. **Ne jamais la committer, ni la partager.** C'est la seule copie
  qui permet de tout déchiffrer : si elle est perdue, les fichiers `.enc`
  commités deviennent illisibles.
- **Clé publique** : affichée par `age-keygen -y ~/.config/sops/age/keys.txt`.
  Celle-ci peut être commitée sans risque.

## 3. Configurer le repo

Remplacer le placeholder dans `.sops.yaml` (racine du repo) par la clé
publique obtenue ci-dessus :

```yaml
creation_rules:
  - path_regex: \.env\.enc$
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 4. Chiffrer / déchiffrer un `.env`

```bash
# Chiffrer prono-core/.env -> prono-core/.env.enc (à committer)
./scripts/secrets.sh encrypt-env prono-core

# Déchiffrer pour déployer (ou après un clone sur une nouvelle machine)
./scripts/secrets.sh decrypt-env prono-core
```

Même principe pour `my-money-hub`, `spec-merger`, `mottaret-watch`.

## 5. Cas d'un fichier binaire (ex : clé privée Enable Banking de `my-money-hub`)

`sops` n'est pas adapté aux fichiers binaires — on chiffre directement avec
`age` :

```bash
./scripts/secrets.sh encrypt-file my-money-hub/secrets/enable-banking-key.pem
# -> my-money-hub/secrets/enable-banking-key.pem.age, à committer

./scripts/secrets.sh decrypt-file my-money-hub/secrets/enable-banking-key.pem.age
```

## Rappels

- On committe uniquement les fichiers chiffrés (`*.env.enc`, `*.age`). Les
  fichiers en clair (`.env`, `.pem`, clé privée age) restent exclus par
  `.gitignore` et ne doivent jamais être poussés.
- Après toute modification d'un `.env`, re-chiffrer et committer le `.enc`
  à jour — sinon la copie versionnée dérive du NAS.
