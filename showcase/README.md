# showcase

Page catalogue statique (FR/EN) qui présente mes apps : **BienvenueBébé**, **prono-core**, **ai-env-manager**.
Inspirée de polymorph.club. Hébergement à décider : le build est agnostique (`base: './'`).

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
