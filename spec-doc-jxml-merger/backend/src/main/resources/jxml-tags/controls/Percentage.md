# Percentage

Contrôler que la valeur saisie correspond à un pourcentage valide, compris entre 0 et 100.

## Élément qui l’utilise

Le contrôle de validité d’un pourcentage est pris en charge par l’élément **NumberBox**, utilisé pour la saisie de valeurs numériques.

## Exemple de code JXML

```xml
 <Question>
  <Label IsTooltipOnly="false">Percentage</Label>
  <NumberBox Name="Percentage" RefreshOnExit="true" FractionDigits="0" NumberOfVisibleCharacters="15" AutoSize="false">
    <Description>Exemple : valeur comprise entre 0 et 100</Description>
    <Control Type="percentage" ErrorType="error" />
  </NumberBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "Percentage" (https://campus.jway.eu/portal/documentation/step/2829).
