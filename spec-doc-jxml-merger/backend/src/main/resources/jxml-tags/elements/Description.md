# Description

Élément permettant d'afficher un message succinct et contextuel afin de fournir une brève explication ou une information supplémentaire sur un autre élément. Utilisable dans les questions et dans le FormFlow (par exemple sous un `Step` ou un `NextStep`).

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `TradId` | — | Attribut technique (ne pas modifier) |

## Exemple de code JXML (dans une Question)

```xml
<Question>
  <Label IsTooltipOnly="false">Nom</Label>
  <TextBox Name="Nom" RefreshOnExit="false" IsReadOnly="false" IsRequired="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false">
    <Description>En caractères majuscule</Description>
  </TextBox>
</Question>
```

## Exemple de code JXML (dans le FormFlow)

```xml
<Step Name="FirstStep">
  <Description>Description de l'élément parent.</Description>
  <ActionsOnValidation>
    <NextStep StepName="Validation">
      <Description>Description de l'étape.</Description>
    </NextStep>
  </ActionsOnValidation>
</Step>
```

Source : documentation JWAY Campus, page "Description" (https://campus.jway.eu/portal/documentation/step/2788).
