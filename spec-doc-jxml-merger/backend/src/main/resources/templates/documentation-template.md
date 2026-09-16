# Gabarit de documentation fonctionnelle

> **Usage** : ce gabarit définit la forme que doit **toujours** prendre la documentation
> produite par l'IA, que la source soit un document Word/PowerPoint/Excel ou le code
> JXML d'un projet. En imposant les mêmes titres, le même découpage et les mêmes
> colonnes de tableau des deux côtés, un même écran documenté depuis la spec et depuis
> le code produit deux markdown structurellement comparables, ce qui rend le diff entre
> les deux versions exploitable (par section, par écran, par élément).
>
> Règles à respecter par l'IA lors de la génération :
> - Reprendre exactement les titres de section ci-dessous (même niveau de titre, même
>   libellé). Ne pas ajouter de section qui n'existe pas ici ; ne pas en omettre une
>   qui a du contenu.
> - Une section sans contenu identifiable dans la source est conservée avec la mention
>   `_Non renseigné dans la source._` plutôt que supprimée, pour que le diff reste
>   aligné section par section.
> - Chaque élément documenté (champ, bouton, pièce jointe, appel de service, …) reçoit
>   un **identifiant stable** (colonne `ID`) : c'est cet identifiant, pas le libellé en
>   langage naturel, qui sert de clé de rapprochement lors du diff entre la version
>   issue de la spec et celle issue du code.
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
| Titre du document | `<titre>` |
| Identifiant / référence du projet | `<id-projet>` |
| Fonctionnalité / démarche / formulaire documenté(e) | `<nom>` |

### Historique des versions

| Version | Date | Auteur | Modifications effectuées |
|---|---|---|---|
| `<x.y>` | `<jj/mm/aaaa>` | `<auteur>` | `<description>` |

### Documents de référence

| Nom du document | Version | Auteur(s) |
|---|---|---|
| `<document>` | `<version>` | `<auteur>` |

## 2. Objectifs et périmètre

- Objectifs de la documentation (que doit-elle permettre de faire : décrire la
  fonctionnalité, ses écrans, ses règles de gestion, ses aides et erreurs).
- Périmètre couvert / non couvert.

## 3. Généralités

| Caractéristique | Valeur |
|---|---|
| Code / identifiant fonctionnel | `<code>` |
| Nom | `<nom>` |
| Canal(-aux) / espace(s) concerné(s) | `<canal>` |
| Mode d'authentification requis | `<mode>` |
| Visibilité (catalogue, moteur de recherche, etc.) | `<oui/non>` |
| Catégorie / thème | `<thème>` |
| Langues de saisie | `<langues>` |

### Organisme / équipe responsable

`<coordonnées ou point de contact fonctionnel, si pertinent>`

### Liens utiles / fonctionnalités associées

| Fonctionnalité associée | Description |
|---|---|
| `<nom>` | `<description>` |

### Rôles et acteurs

Description des rôles distincts s'il y en a (déclarant, gestionnaire, valideur, …) et
de leurs droits respectifs. Si un seul rôle utilisateur existe, le préciser
explicitement plutôt que d'omettre la section.

## 4. Processus

### 4.1. Processus côté utilisateur

- **Saisie** : comment les données sont saisies (assistant pas-à-pas, formulaire
  unique, import, …).
- **Pré-remplissage** : la fonctionnalité peut-elle être initiée avec des données déjà
  connues (fichier déposé, appel préalable, reprise d'une saisie antérieure) ? Sous
  quel format ? Quelle validation est faite sur ces données (syntaxique / fonctionnelle,
  et par quel composant) ?
- **Transmission / soumission** : que se passe-t-il une fois la saisie validée
  (composants produits : document généré, données structurées, pièces jointes) ?
  Comment ces composants restent-ils accessibles ensuite ?
- **Duplication** : la création d'une nouvelle occurrence à l'identique d'une
  précédente est-elle supportée ? Sous conditions ?
- **Rectification** : une occurrence déjà transmise peut-elle être corrigée /
  complétée après coup ? Sous conditions ?

### 4.2. Processus de saisie

#### 4.2.1. Arbre de navigation

Schéma de navigation entre sections et écrans (ou description textuelle équivalente),
avec légende des symboles utilisés, et description des règles de navigation :
- Ordre de parcours des écrans/sections.
- Conditions d'accès à une section/un écran, si certaines sont conditionnelles.
- Comportement en cas de retour en arrière (les écrans suivants doivent-ils être
  reparcourus, les données déjà saisies sont-elles conservées, etc.).

#### 4.2.2. Structure des écrans

| Élément d'écran | Description |
|---|---|
| Titre | Rappel du titre de la fonctionnalité en haut de chaque écran |
| Menu / sommaire | Présentation des sections/écrans, ordre, profondeur maximale |
| Boutons de navigation | Cf. tableau ci-dessous |

##### Boutons de navigation

| Bouton | Description | Condition d'affichage |
|---|---|---|
| `<libellé>` | `<action déclenchée>` | `<condition>` |

#### 4.2.3. Champs de saisie

**Définition générale** : règles par défaut applicables sauf mention contraire dans un
écran (alignement, valeur par défaut, etc.).

**Types de champs**

| Type de champ | Nature, format, taille, contrôle |
|---|---|
| `<nom du type>` | `<description>` |

**Gestion des valeurs par défaut** : règle par défaut appliquée à chaque type de champ
quand aucune valeur par défaut n'est explicitement documentée dans un écran.

**Messages d'erreur standard**

| Erreur | Message affiché |
|---|---|
| `<cas>` | `<message>` |

#### 4.2.4. Blocs de saisie réutilisables

Description de tout bloc de saisie composite réutilisé sur plusieurs écrans (ex. bloc
adresse) : variantes possibles, éléments de chaque variante (même structure de tableau
que la section 5.3 « Éléments »), conditions d'affichage des variantes.

## 5. Contenu — détail par section et par écran

> Répéter ce gabarit pour chaque section, puis pour chaque écran de la section.
> Une section correspond à un regroupement thématique d'écrans ; un écran correspond à
> une page unique présentée à l'utilisateur.

### 5.1. Section : `<nom section>`

#### 5.1.1. Conditions d'affichage

`<condition dans laquelle la section est proposée ; sinon, omettre uniquement cette
sous-section>`

#### 5.1.2. Écran : `<nom écran>`

##### Conditions d'affichage

`<condition dans laquelle l'écran est proposé ; sinon, omettre uniquement cette
sous-section>`

##### Référence visuelle

`<maquette, capture d'écran ou description de la mise en page de l'écran>`

##### Éléments

| ID | Élément (label) | Type : nature, format, taille, contrôle | Valeur par défaut | Condition d'affichage | Obligatoire |
|---|---|---|---|---|---|
| `<id>` | `<label>` | `<type>` | `<valeur>` | `<condition>` | `<oui/non>` |

##### Règles de gestion, aides et messages d'erreur

> Uniquement les règles/aides/erreurs propres à cet écran, en plus des règles
> standards de la section 4.2.3. Omettre cette sous-section si elle est vide.

| Référence (ID d'élément) | Type (règle de gestion / aide / erreur) | Description |
|---|---|---|
| `<id>` | `<type>` | `<description>` |

## 6. Document généré

> Si la fonctionnalité produit un document en sortie (PDF, export, accusé de
> réception, …). Omettre cette section si aucun document n'est généré.

- **En-tête** : contenu affiché en haut du document généré.
- **Structure** : correspondance entre la structure de saisie et celle du document
  généré, écarts éventuels.
- **Pied de page** : contenu affiché en bas du document généré.

## 7. Intégration avec le système cible

### 7.1. Configuration

| Champ | Valeur |
|---|---|
| Mode de traitement | `<description>` |
| Système / application cible | `<nom>` |
| Groupe(s) / file(s) de traitement destinataire(s) | `<liste>` |
| Paiement associé | `<oui/non>` |
| Rectification possible après transmission | `<oui/non>` |
| Ajout de pièces jointes possible après transmission | `<oui/non>` |

### 7.2. Méta-données échangées

| Code | Libellé | Donnée source | Sens (saisie → système cible / système cible → saisie) |
|---|---|---|---|
| `<code>` | `<libellé>` | `<origine>` | `<sens>` |

### 7.3. Format des données échangées

`<précisions sur le format des données transmises au système cible (structure,
schéma de validation, encodage) si des précisions sont nécessaires au-delà du
tableau des éléments de chaque écran>`

### 7.4. Retours automatiques

`<le système cible renvoie-t-il un retour après transmission ? à quelle fréquence
(à chaque échange, uniquement au premier, …), sous quelle forme ?>`

### 7.5. Échanges après transmission

`<des échanges (messagerie, compléments d'information) restent-ils possibles entre
l'utilisateur et le système cible après la transmission initiale ? à l'initiative de
qui ? selon quels modèles de message ?>`

## 8. Pièces jointes

> Une ligne par pièce jointe attendue. Omettre cette section si la fonctionnalité n'en
> comporte aucune.

| ID | Libellé | Obligatoire | Types de fichiers acceptés | Taille max (par fichier) | Nombre max | Condition d'affichage | Contrôles appliqués |
|---|---|---|---|---|---|---|---|
| `<id>` | `<libellé>` | `<oui/non>` | `<extensions/mime-types>` | `<taille>` | `<nombre>` | `<condition>` | `<antivirus / format / lisibilité / …>` |

Règles générales par défaut (sauf mention contraire ci-dessus pour une pièce jointe
donnée) :
- Taille maximale par défaut : `<valeur>`
- Nombre maximal de fichiers par défaut : `<valeur>`
- Types de fichiers acceptés par défaut : `<liste>`
- Contrôle appliqué à l'upload (antivirus, format, lisibilité) : `<description>`
- Devenir des pièces jointes après transmission (accessibilité, conservation, purge) :
  `<description>`

## 9. Appels de service web

> Un bloc par appel de service externe déclenché par la fonctionnalité (vérification,
> enrichissement de données, pré-remplissage, notification, …). Omettre cette section
> si la fonctionnalité n'en effectue aucun.

### 9.1. `<ID / nom du service>`

| Champ | Valeur |
|---|---|
| Déclencheur | `<action ou condition qui déclenche l'appel>` |
| Méthode HTTP | `<GET / POST / PUT / …>` |
| Endpoint | `<url ou référence de configuration ; ne pas figer une URL d'environnement>` |
| Authentification | `<mécanisme (aucune, basic, jeton, mutuel TLS, …)>` |
| Synchrone / asynchrone | `<synchrone bloquant / asynchrone>` |
| Délai d'attente (timeout) | `<valeur>` |
| Comportement en cas d'échec ou de dépassement de délai | `<message affiché, blocage ou poursuite de la saisie, nombre de tentatives>` |

**Données envoyées**

| Champ envoyé | Origine (élément de saisie) |
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

## 10. Annexes — listes de valeurs

### `<NOM_DE_LA_LISTE>`

| Valeur | Libellé |
|---|---|
| `<valeur>` | `<libellé>` |
