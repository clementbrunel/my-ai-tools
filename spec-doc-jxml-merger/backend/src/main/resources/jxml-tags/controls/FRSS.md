# FRSS

Contrôler la validité de la valeur saisie d’un **numéro de sécurité sociale** (SS) en France.

## Élément qui l’utilise

Le contrôle de validité du numéro de sécurité sociale est pris en charge par l’élément **TextBox**, utilisé pour la saisie de valeurs alphanumériques.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">FRSS</Label>
  <TextBox RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" Name="controlOfficial|FRSS">
    <Description>Exemple : 1840857111222/86</Description>
    <Control Type="FRSS" ErrorType="error" />
  </TextBox>
</Question> 
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "FRSS" (https://campus.jway.eu/portal/documentation/step/2813).
