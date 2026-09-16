# Label

Élément qui permet d'insérer un texte indicatif ou descriptif avant un champ de saisie d'une `Question`. Le label doit indiquer clairement à l'utilisateur quelle information est attendue dans le champ de saisie associé.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `IsTooltipOnly` | Bouton | Active l'accessibilité du label (lisible pour des utilisateurs malvoyants ou non-voyants) (défaut : `false`) |
| `TradId` | — | Attribut technique (ne pas modifier) |

## Exemple de code JXML

```xml
<Section Type="standard" OutputMode="all" OutputTarget="all" NewPage="screen">
  <Title>Label</Title>
  <Content OutputMode="all" OutputTarget="all" NewPage="none">
    <Question>
      <Label IsTooltipOnly="false">Désignation</Label>
      <TextBox Name="Designation" RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" />
    </Question>
  </Content>
</Section>
```

Source : documentation JWAY Campus, page "Label" (https://campus.jway.eu/portal/documentation/step/2789).
