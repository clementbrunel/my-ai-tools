# ListItem

L'élément `List` sert à présenter une énumération structurée, où chaque `ListItem` correspond à un point de la liste. Il est idéal pour afficher des contenus courts, tels que des caractéristiques, des étapes ou des rappels.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est visible mais non disponible à la saisie (défaut : `false`) |
| `IsVisible` | Expression | Si l'expression est vraie, l'élément est affiché (défaut : `true`) |

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

Source : documentation JWAY Campus, page "ListItem" (https://campus.jway.eu/portal/documentation/step/2913).
