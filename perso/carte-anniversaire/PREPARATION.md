# Carte cadeau — box AnnaB Crochet

Carte pliée A5 (une feuille A4 imprimée recto-verso, pliée en deux).

- **Les images** (couverture, motifs) viennent de ton skill d'image sur ton PC, avec les visuels du site comme point de départ. Elles ne contiennent **aucun texte**.
- **Le texte** est ajouté séparément, par `carte.html`. Pas de fautes ni de lettres déformées, et tu peux le modifier jusqu'à la dernière minute.

---

## 1. Récupérer les visuels du site (sur ton PC)

Ma session cloud n'a pas accès à annabcrochet.fr. Il faut donc récupérer les visuels depuis ton navigateur :

1. Va sur **annabcrochet.fr**, puis sur la page **« Abonnement BOX CROCHET 2026 »** (dans le menu).
2. Enregistre 2 ou 3 photos (clic droit → « Enregistrer l'image sous… ») : la box ouverte, des pelotes, un ouvrage terminé. Prends la plus grande taille disponible (en ouvrant d'abord l'image dans un nouvel onglet).
3. Range-les dans un dossier `references/` à côté de `carte.html`.

Ces images sont pour un usage strictement personnel, dans une carte qui ne sera ni diffusée ni vendue. Évite seulement d'y mettre le logo de la marque en grand : le nom écrit sur la carte suffit.

---

## 2. Assets fournis pour ton skill (dossier `assets/`)

| Fichier | À quoi il sert |
|---|---|
| `prompts/*.txt` | Un prompt par image, avec le prompt négatif, la taille et les images de référence à joindre. À copier-coller. |
| `prompts/prompts.json` | Les mêmes prompts dans un seul fichier structuré, si ton skill accepte un fichier. |
| `gabarit-recto-composition.png` | Image de **composition** (1748 × 2480, A5 à 300 dpi) : haut vide, sujet dans les 2/3 bas. À donner comme image de contrôle ou d'image-to-image à faible force (~0.3). Elle ne contient aucun texte, donc rien ne se retrouvera écrit sur l'image générée. |
| `gabarit-recto-annote.png` | Le même gabarit, annoté pour **toi** : zone du titre, sujet, marge de 5 mm. Pour vérifier une image générée. **Ne pas le donner au générateur** (il contient du texte). |
| `palette.png` | Les 6 couleurs de la carte, à donner en référence de couleurs si l'option B ne suffit pas. |

**Taille idéale de `recto.png`** : 1748 × 2480 px (proportion exacte de la couverture). En 2:3, la carte recadre légèrement les côtés, sans gravité.

## 3. Trois façons de faire la couverture

| Option | Ce que tu fais | Réglage dans `CONFIG` |
|---|---|---|
| **A. Photo du site telle quelle** | Copie la plus belle photo sous le nom `recto.jpg` | `modeCouverture: "cadre"` (photo encadrée, légèrement penchée, façon Polaroid) |
| **B. Illustration inspirée du site** (recommandée) | Donne une photo du site à ton skill comme **image de référence** (image-to-image / style reference) avec le prompt B | `modeCouverture: "plein"` |
| **C. Illustration sans référence** | Prompt C seul | `modeCouverture: "plein"` |

L'image doit s'appeler `recto.png`, `recto.jpg`, `recto.jpeg` ou `recto.webp` (la carte les cherche dans cet ordre).
Si l'image contient déjà du texte, ou si tu préfères une couverture sans titre, mets `texteCouverture: false`.

### Prompt B : à partir d'une photo du site (référence)

Format : **1748 × 2480 px** (ou portrait 2:3). Force de la référence : moyenne (~0.5–0.6), pour garder les couleurs et les objets sans recopier la photo.

```
Using the reference photo for its colors, yarns and objects, create a soft watercolor
illustration for a birthday card cover, portrait orientation. A crochet subscription box,
half open, with balls of yarn, a crochet hook and a small finished crochet project peeking
out, a kraft gift tag tied with yarn (blank, no writing). Gentle paper texture, airy
cream negative space in the upper third for a title. Warm, tender, handmade feeling.
No text, no letters, no logo, no watermark.
```

### Prompt C : sans référence

```
Soft watercolor illustration for a birthday card cover, portrait orientation.
A gift box wrapped in kraft paper, tied with a chunky pastel yarn instead of a ribbon,
surrounded by balls of wool in dusty pink, terracotta, sage green, cream and mustard,
a wooden crochet hook, a few small crocheted flowers and granny squares, eucalyptus sprigs.
Cozy, handmade feeling, light paper texture, lots of airy cream negative space in the
upper third. No text, no letters, no logo, no watermark.
```

**Prompt négatif (si ton skill le permet)** : `text, letters, words, typography, logo, watermark, signature, frame, border, harsh colors, cluttered`

> Si l'option B donne une palette différente (le site a peut-être d'autres couleurs que celles-ci), garde celle du site : c'est plus cohérent avec la box qu'elle recevra.

### Images facultatives de l'intérieur

- `vignette.png` (carré, fond crème uni) :
  `Small watercolor vignette on a plain cream background: two balls of yarn and a crochet hook with a tiny crocheted heart. Centered, isolated, soft edges. No text, no logo.`
  Tu peux aussi donner une photo du site comme référence.
- `fond-interieur.png` (portrait 2:3, très pâle) :
  `Very light, washed-out watercolor pattern of scattered granny squares, tiny crocheted flowers and thin yarn strands on cream paper, low contrast, lots of empty space. No text, no logo.`

---

## 4. Le texte (déjà en place dans `carte.html`)

**Intérieur droit** (ton texte) :

> *Joyeux anniversaire mon amour,*
>
> Ton cadeau a pris un peu de retard… parce qu'il arrivera **plusieurs fois** !
>
> Chaque mois, une **box AnnaB Crochet** viendra se glisser dans la boîte aux lettres : un nouveau projet, tout le matériel, et rien d'autre à faire que crocheter.
>
> Première box prévue : **décembre**
>
> *Je t'aime,*

**Couverture** : « Joyeux anniversaire » + prénom (désactivable)
**Dos** : encart « BON POUR un abonnement AnnaB Crochet · une box crochet chaque mois · offert avec tout mon amour »
**Intérieur gauche** : vignette + « Maille après maille, on fabrique les plus belles choses. »

Pour mettre le texte au **dos** plutôt qu'à l'intérieur : clique dans l'encart du dos et colle-le, ou demande-moi la variante.

---

## 5. Remplir et imprimer

1. Dans `carte.html`, bloc `CONFIG` : `prenom`, `premiereBox` (la date), `signature` (facultatif, sous « Je t'aime, »), `modeCouverture`, `texteCouverture`.
2. Ouvre `carte.html` dans Chrome ou Edge. Tout texte reste modifiable d'un clic.
3. Ctrl+P : **A4 paysage**, marges **aucune**, échelle **100 %**, **graphiques d'arrière-plan** cochés, **recto-verso bord court**.
4. Fais un essai sur papier ordinaire, puis imprime sur papier épais (200–250 g/m²), et plie au milieu.

- [ ] Première box : décembre · anniversaire : 17 novembre 2026
- [ ] Prénom renseigné, ou titre de couverture désactivé
- [ ] Essai d'impression : le dos et l'intérieur sont dans le bon sens
