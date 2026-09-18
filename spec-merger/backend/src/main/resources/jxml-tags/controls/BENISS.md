# BENISS

Contrôler la validité et le format de la valeur saisie d’un numéro d’identification unique de la sécurité sociale belge (**NISS**).

## Élément qui l'utilise

Ce contrôle s’emploie dans un élément de type TextBox (champ de saisie).

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">BENISS</Label>
  <TextBox RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" 
    Name="controlOfficial|BENISS" DataType="string">
    <Description>Exemple : 42012205181</Description>
    <Control Type="BENISS" ErrorType="error" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "BENISS" (https://campus.jway.eu/portal/documentation/step/2806).
