# BIC

Contrôler la validité et le format de la valeur saisie d’un **code** **BIC** (Bank Identifier Code). Il peut aussi être appelé **SWIFT** (Society for Worldwide Interbank Financial Telecommunication), du nom de l’organisme international gérant les BIC.

## Élément qui l’utilise

Ce contrôle s’emploie dans un élément de type TextBox (champ de saisie).

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">BIC</Label>
  <TextBox 
    Name="controlOfficial|BIC" 
    RefreshOnExit="false" 
    DataType="string" 
    NumberOfVisibleCharacters="20" 
    IsRequired="false" 
    AutoSize="false" 
    IsEnabled="" 
    IsReadOnly="">
    <Description>Exemple : BDFEFRPPCCT</Description>
    <Control ErrorType="error" Type="BIC" />
  </TextBox>
</Question>
```

## Mode flow

Rendu visuel

Source : documentation JWAY Campus, page "BIC" (https://campus.jway.eu/portal/documentation/step/2808).
