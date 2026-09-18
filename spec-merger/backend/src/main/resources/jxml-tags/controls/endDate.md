# endDate

Contrôle la validité de la date saisie en vérifiant qu’elle est postérieure à toute valeur associée au contrôle **startDate **du même groupe.

## Élément qui l’utilise

Le contrôle de validité de la date est pris en charge par l’élément **DateBox**.

## Paramètres

- **Group **: Paramètre qui permet de relier entre elles les dates à contrôler

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">DateBox End</Label>
  <DateBox RefreshOnExit="true" IsRequired="false" Format="form" Name="controlDate|dateBoxEnd" IsEnabled="false" IsReadOnly="false">
    <Control Type="endDate" ErrorType="error">
      <Parameter Name="group" Value="dateBox" />
    </Control>
  </DateBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "endDate" (https://campus.jway.eu/portal/documentation/step/2810).
