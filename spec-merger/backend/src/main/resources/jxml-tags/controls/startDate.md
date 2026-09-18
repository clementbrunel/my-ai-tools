# startDate

Permet de vérifier que la date saisie dans le champ est **antérieure** à la date associée au contrôle **endDate **du même groupe.

## Élément qui l’utilise

- **DateBox** : Permet de saisir une date dans un champ dédié, avec affichage d’un sélecteur (calendrier) et un format de date défini par le projet

## Paramètres

- **Group** : Identifie le groupe qui relie la date de début (**startDate**) et la date de fin (**endDate**) afin de réaliser la comparaison

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">DateBox Start</Label>
  <DateBox Name="controlDate|dateBoxStart" RefreshOnExit="false" IsRequired="false" Format="form" IsEnabled="" IsReadOnly="">
    <Control ErrorType="error" Type="startDate">
      <Parameter Name="group" Value="datesBox" />
    </Control>
  </DateBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "startDate" (https://campus.jway.eu/portal/documentation/step/2839).
