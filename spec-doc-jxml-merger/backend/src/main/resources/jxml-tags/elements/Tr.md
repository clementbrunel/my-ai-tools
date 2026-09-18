# Tr

L'élément `Tr` définit une ligne de tableau. Il s'utilise à l'intérieur de `TableHeader` (en-tête) ou `TableBody` (corps) pour regrouper des cellules `Th` ou `Td` sur une même ligne.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsVisible` | Expression | Si l'expression est vraie, l'élément est affiché (défaut : `true`) |

## Exemple de code JXML

```xml
<Tr>
  <Th Colspan="1" VerticalAlignment="top" Rowspan="1">
    <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Leroy</Paragraph>
  </Th>
  <Th Colspan="1" VerticalAlignment="top" Rowspan="1">
    <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Émile</Paragraph>
  </Th>
</Tr>
```

Source : documentation JWAY Campus, page "Tr" (https://campus.jway.eu/portal/documentation/step/2934).
