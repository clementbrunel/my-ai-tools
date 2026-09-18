# ChoiceSet

Conteneur permettant de regrouper plusieurs options de sélection dans un formulaire. Il fonctionne en association avec l'élément `Option` pour créer des choix interactifs, tels que des évaluations ou des réponses multiples.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `DataType` | Liste | Type de données de l'élément (`String`, `Double`, `Integer`) |
| `HorizontalAlignment` | Liste | Alignement horizontal |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément sera visible mais non modifiable à la saisie (défaut : `false`) |
| `IsVisible` | Expression | Si l'expression est vraie, l'élément est affiché (défaut : `true`) |
| `LabelHorizontalAlignment` | Liste | Alignement horizontal du libellé (`left`, `center`, `right`) |
| `LabelPosition` | Liste | Position du libellé (`left`, `above`, `auto`) |
| `LabelWidth` | | Largeur des libellés |
| `OutputMode` | Liste | Présence de l'élément en `report`, `interview` ou les deux |
| `Spacing` | Liste | Espacement entre les lignes (défaut : `normal`) |
| `StyleName` | Liste ouverte | Permet de choisir, dans la liste déroulante, un style pour l'élément |
| `Width` | En pixels | Largeur (dimension horizontale) de l'élément à l'écran |
| `WidthPaper` | En cm | Largeur (dimension horizontale) de l'élément dans le PDF |

## Exemple de code JXML

```xml
<Section Type="standard" OutputMode="all" OutputTarget="all" NewPage="screen">
  <Title>ChoiceSet</Title>
  <Content OutputMode="all" OutputTarget="all" NewPage="none">
    <ChoiceSet OutputMode="all" Spacing="normal" LabelHorizontalAlignment="left" DataType="string" LabelPosition="auto" OutputTarget="all" HorizontalAlignment="left">
      <Option Value="faible">Faible</Option>
      <Option Value="passable">Passable</Option>
      <Option Value="bien">Bien</Option>
      <Option Value="tresbien">Très Bien</Option>
      <Choice Name="Comprehension" RefreshOnExit="false">
        <Label IsTooltipOnly="false">Évaluez votre niveau de compréhension</Label>
      </Choice>
    </ChoiceSet>
  </Content>
</Section>
```

Source : documentation JWAY Campus, page "ChoiceSet" (https://campus.jway.eu/portal/documentation/step/2930).
