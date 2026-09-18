# Section

Élément de structure permettant de regrouper un ensemble d'éléments sous un titre.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `AutoValidation` | Expression | Si vrai, la section sera validée sans action de l'utilisateur |
| `Id` | String | Identifiant de l'élément, permet notamment de pointer vers cet élément via un `link` |
| `IsReadOnly` | Expression | Si l'expression est vraie, les éléments enfants sont visibles mais non disponibles à la saisie (défaut : `false`) |
| `IsVisible` | Expression | Si l'expression est vraie, alors l'élément est présent (défaut : `true`) |
| `NewPage` | Liste | Type de section. En interview, si `both` ou `screen`, la section est présentée comme une page à part entière lors de l'interview ; sinon comme un élément de la page courante d'une section englobante. En PDF, si `paper` ou `both`, on passe à une nouvelle page (défaut : `screen`) |
| `OutputMode` | Liste | Section présente en `report`, `interview` ou les deux |
| `Type` | Liste | Style d'affichage PDF |

## Remarques

Une `Section` peut être itérée via un `DataIterator`.

## Exemple de code JXML

```xml
<Section Type="standard" OutputMode="all" OutputTarget="all" NewPage="screen" IsVisible="">
  <Title>Etablissement</Title>
  <Content OutputMode="all" OutputTarget="all" NewPage="none">
    <QuestionSet OutputMode="all" LabelHorizontalAlignment="left" LabelPosition="auto" Spacing="normal" OutputTarget="all" HorizontalAlignment="left">
      <Question>
        <Label IsTooltipOnly="false">Nom</Label>
        <TextBox Name="Etablissement|Nom" RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" />
      </Question>
      <Question>
        <Label IsTooltipOnly="false">Prénom</Label>
        <TextBox Name="Etablissement|Prenom" RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" />
      </Question>
    </QuestionSet>
  </Content>
</Section>
```

Source : documentation JWAY Campus, page "Section" (https://campus.jway.eu/portal/documentation/step/2779).
