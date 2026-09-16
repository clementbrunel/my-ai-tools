# QuestionSet

Élément constitué d'un ensemble de `Question`. Permet de gérer un groupe de questions de manière cohérente (par exemple les propriétés de mise en forme ou le titre).

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `HorizontalAlignment` | Liste | Choix de l'alignement horizontal |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsVisible` | Expression | Si l'expression est vraie, l'élément est affiché (défaut : `true`) |
| `LabelHorizontalAlignment` | Liste | Alignement horizontal du label : `left`, `center`, `right` |
| `LabelPosition` | Liste | Position du label : `left`, `above`, `auto` |
| `LabelWidth` | — | Largeur des labels |
| `OutputMode` | Liste | Affiche l'élément uniquement sur le mode sélectionné : `all`, `report`, `interview` (défaut : `all`) |
| `Spacing` | Liste | Espacement entre les lignes : `x-small`, `small`, `normal`, `large`, `x-large` (défaut : `normal`) |
| `StyleName` | Liste ouverte | Style à appliquer à l'élément |
| `Width` | — | Largeur en pixels (dimension horizontale) de l'élément sur un écran |
| `WidthPaper` | — | Largeur en cm (dimension horizontale) de l'élément sur un papier A4 |

## Exemple de code JXML

```xml
<QuestionSet OutputMode="all" LabelHorizontalAlignment="left" LabelPosition="auto" Spacing="normal" OutputTarget="all" HorizontalAlignment="left">
  <Question>
    <Label IsTooltipOnly="false">Nom</Label>
    <TextBox Name="Nom" RefreshOnExit="false" IsReadOnly="false" IsRequired="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" />
  </Question>
  <Question>
    <Label IsTooltipOnly="false">Prénom</Label>
    <TextBox Name="Prenom" RefreshOnExit="false" IsReadOnly="false" IsRequired="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" />
  </Question>
</QuestionSet>
```

Source : documentation JWAY Campus, page "QuestionSet" (https://campus.jway.eu/portal/documentation/step/2795).
