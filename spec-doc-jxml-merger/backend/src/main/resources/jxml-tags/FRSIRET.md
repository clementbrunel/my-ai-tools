# FRSIRET

Contrôler la validité de la valeur saisie d’un numéro **SIRET** (Système d’Identification du Répertoire des Établissements) en France. Il s’agit d’un identifiant unique à 14 chiffres, attribué lors de l’enregistrement d’un établissement.

## Élément qui l’utilise

Le contrôle de validité du numéro **SIRET** est pris en charge par l’élément TextBox, utilisé pour la saisie de valeurs alphanumériques.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">FRSIRET</Label>
  <TextBox RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" Name="controlOfficial|FRSIRET" DataType="string">
    <Description>Exemple : 73282932000074</Description>
    <Control Type="FRSIRET" ErrorType="error" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "FRSIRET" (https://campus.jway.eu/portal/documentation/step/2812).
