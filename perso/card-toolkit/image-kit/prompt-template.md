# Modèle de prompt — image pour un support imprimé

Principe : **l'image ne contient jamais de texte**. Les titres et messages sont posés ensuite
par le gabarit HTML (pas de fautes, retouches possibles jusqu'à l'impression).

Un prompt se construit en 6 blocs, dans cet ordre. Les blocs 3 et 4 sont générés par
`make_assets.py` dans `assets/composition.txt`.

```
[1. SUJET]        Ce qu'on voit, concret et visuel (objets, matières, ambiance).
[2. RÉFÉRENCE]    (si image jointe) "Using the reference photo for its colors and objects, ..."
[3. COMPOSITION]  ← assets/composition.txt, ligne 1
[4. COULEURS]     ← assets/composition.txt, ligne 2
[5. STYLE]        Technique et rendu (voir styles ci-dessous).
[6. SANS TEXTE]   No text, no letters, no words, no logo, no watermark, no signature, no border.
```

**Négatif** (si le skill le permet) :
```
text, letters, words, typography, writing, logo, brand name, watermark, signature, frame, border,
harsh saturated colors, cluttered composition, objects in the top area, cropped subject
```

## Images de référence à joindre

| Fichier | Usage | Force conseillée |
|---|---|---|
| photo(s) dans `references/` | contenu, matières, couleurs réelles | 0.5 – 0.6 |
| `assets/gabarit-composition.png` | placement du sujet (haut libre pour le titre) | ~0.3 |
| `assets/palette.png` | couleurs | faible / « style reference » |
| `assets/gabarit-annote.png` | **jamais** : il contient du texte, c'est pour vérifier à l'œil | — |

## Styles qui marchent bien en impression

- `Soft watercolor illustration, warm handmade feeling, light cotton paper texture, gentle shadows.`
- `Flat gouache illustration, matte textures, simple shapes, mid-century children's book feel.`
- `Delicate ink line drawing with light watercolor washes, lots of white space.`
- `Paper cut-out collage, layered textured papers, soft drop shadows.`

## Images typiques d'une carte pliée A5

| Fichier attendu | Format | Rôle |
|---|---|---|
| `recto.png` (ou .jpg/.webp) | 1748 × 2480 (A5 @300 dpi) | couverture (obligatoire) |
| `vignette.png` | 1024 × 1024, fond uni = couleur 1 de la palette | motif intérieur gauche |
| `fond-interieur.png` | 1748 × 2480, très pâle, faible contraste | fond intérieur gauche |

Vignette : ajouter `Isolated on a plain flat <couleur 1> background, centered, generous empty margin.`
Fond : ajouter `Very light, washed-out, low-contrast pattern, 80% empty space, center especially pale.`

## Vérification avant impression

- [ ] Aucun texte ni pseudo-lettre dans l'image
- [ ] Superposée au `gabarit-annote.png`, la zone titre reste calme
- [ ] Rien d'important dans la marge de sécurité
- [ ] Résolution ≥ 1600 px sur le petit côté pour un A5
