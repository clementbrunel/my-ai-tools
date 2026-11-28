# card-toolkit

Petit kit pour fabriquer des **cartes à imprimer** (anniversaire, naissance, remerciements…)
en combinant un skill de génération d'images (sur le PC) et une mise en page HTML.

**Principe** : les images générées ne contiennent **jamais de texte**. Les titres et
messages sont posés par le gabarit HTML. Ça évite les fautes et les lettres déformées, et
le texte reste modifiable jusqu'à l'impression.

> Les contenus personnels (textes, dates, photos, images générées) vivent dans `perso/projets/`,
> qui est **ignoré par git**. Le dépôt ne contient que les outils.

## Démarrage rapide

```bash
cd perso/card-toolkit
pip install pillow                                  # une seule fois
python new_project.py anniversaire-2027 --palette pastel-lin --titre "Joyeux anniversaire"
```

Puis dans `perso/projets/anniversaire-2027/` :

1. **`contenu.js`** : écrire les textes (couverture, dos, citation, message). Les couleurs de la palette y sont déjà reportées.
2. **`references/`** : déposer les photos de référence (produit, lieu, objet…), si besoin.
3. **`prompts.md`** : compléter le prompt de couverture (sujet, référence, style). La composition et les couleurs sont déjà remplies.
   Générer avec le skill d'image, en joignant les références et `assets/gabarit-composition.png` :
   - `recto.png` (1748 × 2480) : couverture, obligatoire
   - `vignette.png`, `fond-interieur.png` : facultatifs
4. **`carte.html`** : ouvrir dans Chrome ou Edge et vérifier. Un clic sur un texte permet une retouche de dernière minute.
5. **Ctrl+P** : A4 **paysage**, marges **aucune**, échelle **100 %**, **arrière-plans** activés, **recto-verso bord court**.
   Faire un essai sur papier ordinaire, puis imprimer sur papier 200–250 g/m², et plier au milieu.

## Contenu

| Chemin | Rôle |
|---|---|
| `new_project.py` | Crée `perso/projets/<nom>/` (gabarit, contenu, assets, prompts). `--force` régénère les fichiers sans toucher à `contenu.js` ni `references/`. |
| `templates/carte-pliee-a5.html` | Carte pliée A5 (feuille A4 recto-verso) : couverture (image bord à bord ou photo encadrée), dos avec encart « bon pour », intérieur gauche (vignette + citation), message. Tout le texte vient de `contenu.js`. |
| `exemple/contenu.js` | Modèle de contenu neutre et commenté (`**gras**`, `\n` pour un retour à la ligne, champ vide = masqué). |
| `image-kit/make_assets.py` | Gabarit de composition (sans texte, pour le générateur), gabarit annoté (pour vérifier), nuancier, phrase de composition. Formats : `a5`, `a6`, `a4`, `carre`, `10x15` ou `LxH` en mm, avec `--paysage`, `--zone-titre`, `--marge`. Fonctionne aussi seul pour d'autres petits supports (marque-page, étiquette, affichette). |
| `image-kit/palettes.json` | Palettes prêtes à l'emploi (`pastel-lin`, `hiver`, `bebe`). L'ordre des couleurs compte (voir `_ordre`). Une liste `"#hex,#hex,…"` marche aussi. |
| `image-kit/prompt-template.md` | Structure de prompt en 6 blocs, styles adaptés à l'impression, images de référence à joindre, check-list. |

## Bonnes pratiques

- Ne jamais donner `gabarit-annote.png` au générateur : il contient du texte.
- Pour une photo trouvée sur un site marchand ou de marque, utiliser le mode `couverture.mode: "cadre"` ou s'en servir comme référence, pour un usage strictement privé.
- Si l'image a déjà un titre, mettre `couverture.afficherTexte: false`.
- Pour un dos vierge : `dos: null`.
