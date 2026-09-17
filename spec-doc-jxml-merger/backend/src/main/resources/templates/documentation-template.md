# Gabarit de documentation fonctionnelle

> **Usage** : ce gabarit définit la forme que doit **toujours** prendre la documentation
> produite par l'IA, que la source soit un document Word/PowerPoint/Excel ou le code
> JXML d'un projet. En imposant les mêmes titres, le même découpage et les mêmes
> colonnes de tableau des deux côtés, un même écran documenté depuis la spec et depuis
> le code produit deux markdown structurellement comparables, ce qui rend le diff entre
> les deux versions exploitable (par section, par écran, par élément).
>
> Règles à respecter par l'IA lors de la génération :
> - **Un seul gabarit pour les deux sources** : produis-le dans son intégralité et dans
>   le même ordre, que tu génères depuis le Word/PowerPoint/Excel ou depuis le JXML —
>   même quand tu sais par avance qu'une source donnée ne pourra pas remplir telle ou
>   telle section (ex. les « Généralités » depuis un JXML seul). Ce n'est jamais un
>   prétexte pour sauter une section ou une ligne de tableau : elle est conservée avec
>   `_Non renseigné dans la source._` (ou une valeur vide dans un tableau). C'est cette
>   parité structurelle — pas le contenu — qui permet ensuite de comparer les deux
>   générations section par section, écran par écran, élément par élément.
> - Reprendre exactement les titres de section ci-dessous (même niveau de titre, même
>   libellé). Ne pas ajouter de section qui n'existe pas ici.
> - Chaque élément documenté (champ, bouton, pièce jointe, appel de service, …) reçoit
>   pour `ID` **son libellé tel qu'affiché à l'utilisateur** (le texte du `<Label>` côté
>   JXML, la colonne « Élément » côté Word) — jamais un identifiant technique ou un
>   numéro de position. Le même libellé des deux côtés est ce qui permet au diff de
>   rapprocher un champ Word et son équivalent JXML sans clé technique commune.
>   - **Depuis le JXML** : le libellé vient de la résolution des clés `trans(...)`.
>     Tant que cette résolution n'est pas branchée (issue #285), laisse l'appel
>     `trans(...)` tel quel — comme demandé plus bas pour le JXML — et il sert alors
>     d'ID brut, provisoirement pas comparable au libellé français du Word. C'est une
>     limite connue et temporaire, à ne pas contourner en inventant une traduction.
>   - **Deux éléments avec le même libellé sur un même écran** (ex. un bloc
>     « Représentant » répété) : désambiguïser en suffixant l'ID par sa position
>     d'apparition parmi les éléments de même libellé sur cet écran (`Prénom (1)`,
>     `Prénom (2)`, …), jamais en inventant un identifiant technique.
> - Aucune notion propre à une plateforme ou un back-office particulier ne doit
>   apparaître : les intitulés ci-dessous sont volontairement génériques (« système
>   cible », « canal », « écran ») à charge pour le contenu généré de rester neutre.
> - Les valeurs entre chevrons (`<comme ceci>`) sont des placeholders à remplacer par
>   le contenu réel ; s'ils ne peuvent pas être renseignés, les laisser tels quels
>   plutôt que d'inventer une valeur.

---

## 1. En-tête du document

| Champ | Valeur |
|---|---|
| Identifiant / référence du projet | `<id-projet>` |
| Fonctionnalité / démarche / formulaire documenté(e) | `<titre du formulaire principal choisi>` |

### Historique des versions

| Version | Date | Auteur | Modifications effectuées |
|---|---|---|---|
| `<x.y>` | `<jj/mm/aaaa>` | `<auteur>` | `<description>` |

> Généré depuis le JXML/texte source seul : une seule ligne, avec la date de
> génération et `Génération automatique depuis la source` en modification — Version et
> Auteur laissés vides. Généré depuis un Word qui contient déjà un historique : le
> reprendre tel quel plutôt que de le remplacer.

## 2. Généralités

| Caractéristique | Valeur |
|---|---|
| Code / identifiant fonctionnel | `<code>` |
| Nom | `<nom>` |
| Canal(-aux) / espace(s) concerné(s) | `<canal>` |
| Mode d'authentification requis | `<mode>` |
| Visibilité (catalogue, moteur de recherche, etc.) | `<oui/non>` |
| Catégorie / thème | `<thème>` |
| Langues de saisie | `<langues>` |

## 3. Arbre de navigation

Schéma de navigation entre sections et écrans (ou description textuelle équivalente),
avec légende des symboles utilisés, et description des règles de navigation :
- Ordre de parcours des écrans/sections.
- Conditions d'accès à une section/un écran, si certaines sont conditionnelles.
- Comportement en cas de retour en arrière (les écrans suivants doivent-ils être
  reparcourus, les données déjà saisies sont-elles conservées, etc.).

## 4. Contenu — détail par section et par écran

> Répéter ce gabarit pour chaque section, puis pour chaque écran de la section.
> Une section correspond à un regroupement thématique d'écrans ; un écran correspond à
> une page unique présentée à l'utilisateur.

### 4.1. Section : `<nom section>`

#### 4.1.1. Conditions d'affichage

`<condition dans laquelle la section est proposée ; sinon, omettre uniquement cette
sous-section>`

#### 4.1.2. Écran : `<nom écran>`

##### Conditions d'affichage

`<condition dans laquelle l'écran est proposé ; sinon, omettre uniquement cette
sous-section>`

##### Référence visuelle

`<maquette, capture d'écran ou description de la mise en page de l'écran>`

##### Éléments

> Colonne `ID` : cf. règle d'attribution des identifiants en tête de document (le
> libellé de l'élément, pas une clé technique).

| ID | Élément (label) | Type : nature, format, taille, contrôle | Valeur par défaut | Condition d'affichage | Obligatoire |
|---|---|---|---|---|---|
| `<id>` | `<label>` | `<type>` | `<valeur>` | `<condition>` | `<oui/non>` |

##### Règles de gestion, aides et messages d'erreur

> Uniquement les règles/aides/erreurs propres à cet écran. Omettre cette sous-section
> si elle est vide.

| Référence (ID d'élément) | Type (règle de gestion / aide / erreur) | Description |
|---|---|---|
| `<id>` | `<type>` | `<description>` |

##### Pièces jointes

> Une ligne par pièce jointe attendue sur cet écran. Omettre cette sous-section si
> l'écran n'en comporte aucune.

| ID | Libellé | Obligatoire | Types de fichiers acceptés | Taille max (par fichier) | Nombre max | Condition d'affichage | Contrôles appliqués |
|---|---|---|---|---|---|---|---|
| `<id>` | `<libellé>` | `<oui/non>` | `<extensions/mime-types>` | `<taille>` | `<nombre>` | `<condition>` | `<antivirus / format / lisibilité / …>` |

##### Appels de service web

> Un bloc par appel de service externe déclenché depuis cet écran (vérification,
> enrichissement de données, pré-remplissage, notification, …). Omettre cette
> sous-section si l'écran n'en déclenche aucun.

###### `<nom du service>`

| Champ | Valeur |
|---|---|
| Déclencheur | `<élément de cet écran ou condition qui déclenche l'appel>` |
| Méthode HTTP | `<GET / POST / PUT / …>` |
| Endpoint | `<url ou référence de configuration ; ne pas figer une URL d'environnement>` |
| Authentification | `<mécanisme (aucune, basic, jeton, mutuel TLS, …)>` |
| Synchrone / asynchrone | `<synchrone bloquant / asynchrone>` |
| Délai d'attente (timeout) | `<valeur>` |
| Comportement en cas d'échec ou de dépassement de délai | `<message affiché, blocage ou poursuite de la saisie, nombre de tentatives>` |

**Données envoyées**

| Champ envoyé | Origine (élément de cet écran) |
|---|---|
| `<champ>` | `<id d'élément source>` |

**Données reçues et mapping**

| Champ reçu | Élément/donnée alimenté(e) |
|---|---|
| `<champ>` | `<id d'élément ou donnée cible>` |

**Gestion des erreurs**

| Code / cas d'erreur | Comportement |
|---|---|
| `<code ou cas>` | `<message affiché / action>` |

## 5. Méta-données échangées

| Code | Libellé | Donnée source | Sens (saisie → système cible / système cible → saisie) |
|---|---|---|---|
| `<code>` | `<libellé>` | `<origine>` | `<sens>` |
