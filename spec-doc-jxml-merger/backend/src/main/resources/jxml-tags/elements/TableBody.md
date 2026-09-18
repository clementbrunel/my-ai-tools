# TableBody

L'élément `TableBody` est un conteneur qui permet de regrouper une ou plusieurs lignes de données pour constituer le corps d'un tableau.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsVisible` | Expression | Si l'expression est vraie, l'élément est affiché (défaut : `true`) |
| `StyleName` | Liste ouverte | Permet de choisir, dans la liste déroulante, un style pour l'élément |

## Remarques

Il est possible d'ajouter les lignes de manière dynamique en utilisant une itération.

## Exemple de code JXML

```xml
<TableBody>
  <Tr>
    <Td Colspan="1" VerticalAlignment="top" Rowspan="1">
      <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Dupont</Paragraph>
    </Td>
    <Td Colspan="1" VerticalAlignment="top" Rowspan="1">
      <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Jean</Paragraph>
    </Td>
  </Tr>
</TableBody>
```

Source : documentation JWAY Campus, page "TableBody" (https://campus.jway.eu/portal/documentation/step/2935).
