# RangeDate

Contrôler la saisie d’une date avec une borne minimale et/ou maximale.

## Règles de validation des dates

- Si **min** et **max** sont définis : seules les dates comprises dans cet intervalle sont valides
- Si seule la valeur **min** est définie : seules les dates **à partir de min** sont valides
- Si seule la valeur **max** est définie : seules les dates **jusqu’à max** sont valides

## Élément qui l’utilise

- **DateBox** : champ utilisé pour la saisie ou la sélection d’une date

## Paramètres

- **Min** : borne minimale autorisée pour le champDans l’exemple, **getDate()** correspond à la date du jour
- **Max** : borne maximale autorisée pour le champDans l’exemple, **addDays(getDate(), 10**) fixe la borne maximale à 10 jours après la date du jour

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">RangeDate</Label>
  <DateBox Name="controlDate|dateBoxRange" RefreshOnExit="false" IsRequired="false" Format="form" IsEnabled="" IsReadOnly="">
    <Control Type="RangeDate" ErrorType="error">
      <Parameter Name="min" Value="getDate()" />
      <Parameter Name="max" Value="addDays(getDate(), 10)" />
    </Control>
  </DateBox>
</Question>
```

## Mode flow

Source : documentation JWAY Campus, page "RangeDate" (https://campus.jway.eu/portal/documentation/step/2833).
