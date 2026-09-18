# TableHeader

L'élément `TableHeader` permet de définir l'entête d'un tableau, c'est-à-dire la partie supérieure où sont placés les titres de colonnes.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `StyleName` | Liste ouverte | Permet de choisir, dans la liste déroulante, un style pour l'élément |

## Exemple de code JXML

```xml
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
```

Source : documentation JWAY Campus, page "TableHeader" (https://campus.jway.eu/portal/documentation/step/2936).
