# cbl-log

Visualiseur de logs temps réel pour Windows, portage moderne et personnalisable de [BareTail](https://www.baremetalsoft.com/baretail/) :
suivi instantané de fichiers de toute taille, **rolling géré sans perte de ligne**, surlignage regex,
filtres, parseurs de format, profils, vue fusionnée multi-fichiers.

> **Statut : M0 en cours** — squelette du workspace (moteur, types partagés, app Electron) ; pas encore de fonctionnalité.

- [Cahier des charges fonctionnel](./docs/cahier-des-charges-fonctionnel.md)
- [Dossier d'architecture](./docs/architecture.md)

Pile : Electron + TypeScript + React (Windows 10/11).

## Développement

Monorepo npm workspaces : `packages/shared` (types + schémas zod), `packages/engine` (moteur TS pur Node, testé avec vitest), `app` (Electron + electron-vite + React 18).

```bash
cd cbl-log
npm install        # installe les dépendances (npm ci en CI)
npm run dev        # lance l'app Electron en mode dev (electron-vite)
npm run typecheck  # tsc --noEmit sur tous les workspaces
npm test           # vitest (moteur)
npm run build      # build shared, engine puis app (sortie app/out)
```
