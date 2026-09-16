# Content

Bloc pouvant contenir un ou plusieurs contenus. Permet de structurer le formulaire, ainsi que de styliser et/ou de gérer la visibilité de plusieurs éléments.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est visible mais non disponible à la saisie (défaut : `false`) |
| `IsVisible` | Expression | Si l'expression est vraie, l'élément est présent (défaut : `true`) |
| `NewPage` | Liste | Si `paper`, ce content provoque un saut de page en PDF |
| `OutputMode` | Liste | Affiche l'objet uniquement sur le mode sélectionné : `all`, `report`, `interview` (défaut : `all`) |
| `StyleName` | Liste ouverte | Style à appliquer à l'élément, choisi dans la liste déroulante |

## Remarques

- Un `Content` peut être itéré via un `DataIterator`.

Source : documentation JWAY Campus, page "Content" (https://campus.jway.eu/portal/documentation/step/2771).
