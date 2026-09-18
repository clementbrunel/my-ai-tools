# Td

L'élément `Td` représente une cellule de données dans un tableau. Il s'insère à l'intérieur d'une ligne `Tr` et contient le contenu affiché (par exemple un `Paragraph`). On l'utilise pour structurer les colonnes d'un tableau, cellule par cellule.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Colspan` | | Permet de fusionner les cellules horizontalement (de la même ligne) |
| `Rowspan` | | Permet de fusionner les cellules verticalement (de la même colonne) |
| `StyleName` | Liste ouverte | Permet de choisir, dans la liste déroulante, un style pour l'élément |
| `VerticalAlignment` | Liste | Permet de choisir l'alignement vertical du contenu à l'intérieur de la cellule |

## Exemple de code JXML

```xml
<Td Colspan="1" VerticalAlignment="top" Rowspan="1">
  <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all"></Paragraph>
</Td>
```

Source : documentation JWAY Campus, page "Td" (https://campus.jway.eu/portal/documentation/step/2937).
