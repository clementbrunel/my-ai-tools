# cbl-log

Visualiseur de logs temps réel pour Windows, portage moderne et personnalisable de [BareTail](https://www.baremetalsoft.com/baretail/) :
suivi instantané de fichiers de toute taille, **rolling géré sans perte de ligne**, surlignage regex,
filtres, parseurs de format, profils, vue fusionnée multi-fichiers.

> **Statut : version 1.0.1.**

- [Cahier des charges fonctionnel](./docs/cahier-des-charges-fonctionnel.md)
- [Dossier d'architecture](./docs/architecture.md)

Pile : Electron + TypeScript + React (Windows 10/11).

## Développement

Monorepo npm workspaces : `packages/shared` (types + schémas zod), `packages/engine` (moteur TS pur Node, testé avec vitest), `app` (Electron + electron-vite + React 18).

```bash
cd cbl-log
npm install        # installe les dépendances (npm ci en CI)
npm run dev        # reconstruit shared + engine puis lance l'app Electron en mode dev (electron-vite)
npm run typecheck  # tsc --noEmit sur tous les workspaces
npm test           # vitest (moteur)
npm run build      # build shared, engine puis app (sortie app/out)
npm run package    # installeur NSIS + exe portable dans release/ (Windows x64)
npm run package:dir  # idem sans installeur : release/win-unpacked/cbl-log.exe
```

## Packaging et release

`electron-builder.yml` produit `cbl-log-Setup-<version>.exe` (NSIS, installation par utilisateur) et `cbl-log-<version>-portable.exe`.
Pas de télémétrie ni de mise à jour automatique (NF-07). Les exécutables ne sont pas signés : Windows SmartScreen peut afficher un avertissement.

Publier une version : poser un tag `cbl-log-vX.Y.Z` sur `main` et le pousser. Le job `release` du workflow
`cbl-log – CI` construit les deux exécutables (version issue du tag) et les attache à une release GitHub.
