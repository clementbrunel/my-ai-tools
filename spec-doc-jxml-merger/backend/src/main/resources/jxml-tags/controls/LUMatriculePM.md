# LUMatriculePM

Contrôler la validité de la valeur saisie **d’un numéro matricule** **PM** (Personne morale) luxembourgeois.

## Élément qui l'utilise

Le contrôle de validité **du numéro matricule PM** est pris en charge par l’élément **TextBox**, utilisé pour la saisie de valeurs alphanumériques.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">LUMatriculePM</Label>
  <TextBox RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" Name="controlOfficial|LUMatriculePM">
    <Description>Exemple : 1893120105732</Description>
    <Control Type="LUMatriculePM" ErrorType="error" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "LUMatriculePM" (https://campus.jway.eu/portal/documentation/step/2824).
