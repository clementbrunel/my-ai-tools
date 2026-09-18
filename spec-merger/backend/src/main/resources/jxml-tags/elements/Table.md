# Table

Présentation tabulaire d'éléments. Déconseillée pour présenter des itérations de questions en interview, pour des raisons de responsivité et d'accessibilité.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `HorizontalAlignment` | Liste | Choix de l'alignement horizontal |
| `IsReadOnly` | Expression | Si l'expression est vraie, les éléments enfants sont visibles mais non disponibles à la saisie (défaut : `true`) |
| `IsVisible` | Expression | Si l'expression est vraie, alors l'élément est présent (défaut : `true`) |
| `OutputMode` | Liste | Table présente en `report`, `interview` ou les deux |
| `Spacing` | Liste | Permet de varier l'espacement entre les lignes (défaut : `normal`) |
| `StyleName` | Liste ouverte | Applique un style à la table |
| `Width` | — | Proportion utilisée pour l'affichage en HTML/PDF |
| `WidthPaper` | — | Proportion utilisée pour l'affichage en PDF (prioritaire sur `Width`) |

## Exemple de code JXML

```xml
<Table OutputMode="all" Spacing="normal" OutputTarget="all">
  <ColumnDefinitions>
    <ColumnDefinition Width="50%"/>
    <ColumnDefinition Width="50%"/>
  </ColumnDefinitions>
  <TableHeader>
    <Tr>
      <Th Colspan="1" VerticalAlignment="top" Rowspan="1">
        <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Col 1 Titre</Paragraph>
      </Th>
      <Th Colspan="1" VerticalAlignment="top" Rowspan="1">
        <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Col 2 Titre</Paragraph>
      </Th>
    </Tr>
  </TableHeader>
  <TableBody>
    <Tr>
      <Th Colspan="1" VerticalAlignment="top" Rowspan="1">
        <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Ligne 1 Titre</Paragraph>
      </Th>
      <Td Colspan="1" VerticalAlignment="top" Rowspan="1">
        <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Ligne 1 Contenu</Paragraph>
      </Td>
    </Tr>
  </TableBody>
</Table>
```

Source : documentation JWAY Campus, page "Table" (https://campus.jway.eu/portal/documentation/step/2780).
