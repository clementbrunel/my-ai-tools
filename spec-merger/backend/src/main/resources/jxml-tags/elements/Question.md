# Question

Élément central des documents interactifs (interviews web). On y insère des champs de saisie qui captent les informations dynamiques des formulaires intelligents (`TextBox`, `CheckBox`, `ComboBox`, etc.). Peut être contenu dans un `QuestionSet` ou dans un `Paragraph`.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `IsVisible` | Expression | Si l'expression est vraie, l'élément est affiché (défaut : `true`) |
| `StyleName` | Liste ouverte | Style à appliquer à l'élément |

## Exemple de code JXML

```xml
<Question>
   <Label IsTooltipOnly="false">Nom</Label>
   <TextBox Name="Nom" RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="true" />
</Question>
```

Source : documentation JWAY Campus, page "Question" (https://campus.jway.eu/portal/documentation/step/2794).
