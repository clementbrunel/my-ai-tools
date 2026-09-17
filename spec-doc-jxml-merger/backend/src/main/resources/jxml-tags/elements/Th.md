# Th

L'élément `Th` représente une cellule d'en-tête de colonne dans un tableau (`Table`). Il s'utilise à l'intérieur d'une ligne `Tr` pour nommer chaque colonne et améliorer la lisibilité du `TableHeader`.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Colspan` | | Permet de fusionner les cellules horizontalement (de la même ligne) |
| `Rowspan` | | Permet de fusionner les cellules verticalement (de la même colonne) |
| `StyleName` | Liste ouverte | Permet de choisir, dans la liste déroulante, un style pour l'élément |
| `VerticalAlignment` | Liste | Permet de choisir l'alignement vertical du contenu à l'intérieur de la cellule |

## Exemple de code JXML

```xml
<Table OutputMode="all" Spacing="normal" OutputTarget="all">
  <ColumnDefinitions>
    <ColumnDefinition Width="50%" />
    <ColumnDefinition Width="50%" />
  </ColumnDefinitions>

  <TableHeader StyleName="">
    <Tr>
      <Th Colspan="1" VerticalAlignment="top" Rowspan="1">
        <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Nom</Paragraph>
      </Th>
      <Th Colspan="1" VerticalAlignment="top" Rowspan="1">
        <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Prénom</Paragraph>
      </Th>
    </Tr>
  </TableHeader>
</Table>
```

Source : documentation JWAY Campus, page "Th" (https://campus.jway.eu/portal/documentation/step/2941).
