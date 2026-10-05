# showcase

Page catalogue statique (FR/EN) qui présente mes apps : **BienvenueBébé**, **prono-core**, **ai-env-manager**.
Inspirée de polymorph.club. Servie par GitHub Pages sur https://clementbrunel.github.io (le build reste agnostique : `base: './'`).

## Ajouter / modifier une app

Éditer le tableau `apps` dans [`src/apps.ts`](./src/apps.ts) (textes FR/EN, tags, liens, barre de progression « en cours »). Chaque app a un thème de scène et, pour BienvenueBébé et prono-core,
une affiche générée par IA (`scene`) ; ai-env-manager garde son terminal dessiné.
Pour changer une affiche : déposer l'image dans `public/scenes/`, renseigner `scene` (et `sceneRatio` si du texte est posé dessus) dans `src/apps.ts`.

## Structure

```
src/
  apps.ts              catalogue (données) + liens du profil
  legal.ts             infos éditeur des mentions légales
  App.tsx              routage (#/ ou #/legal), langue, section active
  scenes/              une scène par app : PronoCoreScene, BienvenueBebeScene, AiEnvManagerScene
    index.ts           registre `stage` → composant
  fonts.ts             polices auto-hébergées (@fontsource, latin, graisses utilisées) — aucun appel à Google Fonts
  components/          SceneFrame (cadre commun), Hero, About, Dock (barre de nav), Legal, AppIcon, ProgressBar
  lib/                 scroll.ts (progression + fondu), nav.ts (hash, scène active), ui.ts (textes, langue, scroll doux)
```

Nouvelle app : entrée dans `apps.ts` + un composant dans `scenes/` (basé sur `SceneFrame` ; `art` pour une illustration dessinée, `overlay` pour du texte posé sur une affiche) + une ligne dans `scenes/index.ts`.

## Page d'accueil

Thème sombre (titre « CLÉMENT / BRUNEL » en majuscules, contour sur le nom). Pour ajouter une image sombre en fond,
déposer `public/scenes/hero.jpg` et renseigner `heroScene` dans `src/apps.ts`.

## Commandes

```bash
npm install
npm run dev     # dev server
npm run build   # → dist/ (statique, à déposer n'importe où)
```

## Déploiement (GitHub Pages)

Les sources restent ici ; le workflow [`showcase-deploy.yml`](../.github/workflows/showcase-deploy.yml) build le site
(`npm ci && npm run build`) et pousse **uniquement `showcase/dist`** vers le dépôt public
`clementbrunel/clementbrunel.github.io`, servi à la racine par GitHub Pages.
Déclenchement : push sur `main` touchant `showcase/**`, ou manuellement (`workflow_dispatch`).

Mise en place (une seule fois) :

1. Créer le dépôt public `clementbrunel/clementbrunel.github.io`, avec un premier commit sur `main`,
   puis *Settings → Pages → Deploy from a branch → `main` / `(root)`*.
2. Générer une clé : `ssh-keygen -t ed25519 -N "" -C showcase-deploy -f deploy_key`.
3. Ajouter `deploy_key.pub` en *Deploy key* (avec accès en écriture) du dépôt Pages.
4. Ajouter le contenu de `deploy_key` comme secret `PAGES_DEPLOY_KEY` de `my-ai-tools`, puis supprimer les deux fichiers locaux.

Domaine personnalisé plus tard : ajouter un fichier `CNAME` dans `public/` (il sera copié dans `dist/`).
