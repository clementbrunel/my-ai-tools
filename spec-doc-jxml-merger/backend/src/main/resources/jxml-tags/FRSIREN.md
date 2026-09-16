# FRSIREN

Contrôle la validité de la valeur saisie d’un numéro **SIREN** (Système d’Identification au Répertoire des Entreprises) en France. Il s’agit d’un identifiant unique à 9 chiffres, attribué lors de l’enregistrement d’une entreprise.

## Élément qui l’utilise

Le contrôle de validité du numéro SIREN est pris en charge par l’élément `TextBox`, utilisé pour la saisie de valeurs alphanumériques.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">FRSIREN</Label>
  <TextBox RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" Name="controlOfficial|FRSIREN">
    <Description>Exemple : 732829320</Description>
    <Control Type="FRSIREN" ErrorType="error" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "FRSIREN" (https://campus.jway.eu/portal/documentation/step/2811).
