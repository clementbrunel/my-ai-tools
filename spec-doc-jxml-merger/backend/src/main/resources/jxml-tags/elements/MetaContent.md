# MetaContent

Définition de contenus périphériques au remplissage du formulaire.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Type` | — | Identifiant du `MetaContent` |

## Types notables de MetaContent

| Type | Rôle |
|---|---|
| `Pre-execution` | Dédié au calcul, rassemble « l'intelligence » du formulaire pour l'exécuter à chaque page |
| `Accessibility` | Page de déclaration d'accessibilité |
| `Delete` | Page d'abandon du formulaire |
| `Exited` | Page affichée après abandon |
| `Error` | Page de gestion des KO techniques du formulaire |
| `InputErrors` | Page listant les erreurs et avertissements |
| `FirstPageFooter` / `footer` | Pied de page du PDF (thème custom uniquement) |
| `FirstPageHeader` / `header` | En-tête du PDF (thème custom uniquement) |
| `LoadSession` | Page de chargement du datastore |
| `Share` | Page de partage de la démarche |
| `Validation` | Page de validation |
| `ValidationSucceeded` | Page post-validation |

Source : documentation JWAY Campus, page "MetaContent" (https://campus.jway.eu/portal/documentation/step/2774).
