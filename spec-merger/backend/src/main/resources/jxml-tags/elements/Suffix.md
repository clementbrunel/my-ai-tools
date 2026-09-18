# Suffix

Élément qui permet d'insérer un texte indicatif après un champ de saisie.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `TradId` | — | Attribut technique (ne pas modifier) |

## Exemple de code JXML

```xml
<Section Type="standard" OutputMode="all" OutputTarget="all" NewPage="screen">
  <Title>MemoBox</Title>
  <Content OutputMode="all" OutputTarget="all" NewPage="none" StyleName="">
    <QuestionSet OutputMode="all" LabelHorizontalAlignment="center" LabelPosition="left" Spacing="normal" OutputTarget="all" HorizontalAlignment="center">
      <Question>
        <Label IsTooltipOnly="false">Décrire l'entreprise</Label>
        <MemoBox Name="Memo" RefreshOnExit="false" IsReadOnly="false" IsRequired="false" NumberOfVisibleRows="4" NumberOfVisibleCharacters="200" AutoSize="true" />
        <Suffix>Dire l'essentiel</Suffix>
      </Question>
    </QuestionSet>
  </Content>
</Section>
```

Source : documentation JWAY Campus, page "Suffix" (https://campus.jway.eu/portal/documentation/step/2798).
