# List

Liste à puces ou numérotée.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `IsReadOnly` | Expression | Si l'expression est vraie, les éléments enfants sont visibles mais non disponibles à la saisie (défaut : `false`) |
| `IsVisible` | Expression | Si l'expression est vraie, alors l'élément est présent (défaut : `true`) |
| `MarkerStyle` | Liste | Type de marqueur / numérotation de la liste |
| `OutputMode` | Liste | Liste présente en `report`, `interview` ou les deux |
| `Spacing` | Liste | Permet de varier l'espacement entre les lignes (défaut : `normal`) |

## Exemple de code JXML

```xml
<List OutputMode="all" Spacing="normal" OutputTarget="all">
  <Title>Les éléments de la nature</Title>
  <ListItem>
    <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Le feu</Paragraph>
  </ListItem>
  <ListItem>
    <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">L'eau</Paragraph>
  </ListItem>
</List>
```

Source : documentation JWAY Campus, page "List" (https://campus.jway.eu/portal/documentation/step/2773).
