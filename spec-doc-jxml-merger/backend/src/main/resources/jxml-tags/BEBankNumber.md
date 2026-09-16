# BEBankNumber

Contrôler la validité et le format de la saisie d’un **IBAN** belge (International Bank Account Number).

## Élément qui l’utilise

Ce contrôle s’emploie dans un élément de type **TextBox **(champ de saisie).

## **Exemple de code JXML**

```xml
<Question>
  <Label IsTooltipOnly="false">BEBankNumber</Label>
  <TextBox RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false"
  Name="controlOfficial|BEBankNumber">
    <Description>Exemple : 123412341275</Description>
    <Control Type="BEBankNumber" ErrorType="error" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "BEBankNumber" (https://campus.jway.eu/portal/documentation/step/2804).
