# LUMatriculePP

Contrôler la validité de la valeur saisie **d’un numéro matricule PP** (personne physique) luxembourgeois, qui correspond au numéro d’identification attribué à chaque personne physique.

## Élément qui l'utilise

Le contrôle de validité **du numéro matricule PP** est pris en charge par l’élément **TextBox**, utilisé pour la saisie de valeurs alphanumériques.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">LUMatriculePP</Label>
  <TextBox RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" Name="controlOfficial|LUMatriculePP">
    <Description>Exemple : 1893120105732</Description>
    <Control Type="LUMatriculePP" ErrorType="error" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "LUMatriculePP" (https://campus.jway.eu/portal/documentation/step/2825).
