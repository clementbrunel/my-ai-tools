# NACE

Contrôler la validité de la valeur saisie d’un** code NACE **(Nomenclature statistique des activités économiques dans la Communauté européenne). 
Ce code sert de référence pour le relevé de statistiques à l’échelle européenne.

## Élément qui l’utilise

Le contrôle de validité du **code NACE** est pris en charge par l’élément **TextBox**, utilisé pour la saisie de valeurs alphanumériques.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">NACE</Label>
  <TextBox Name="controlOfficial|NACE" RefreshOnExit="false" DataType="string" NumberOfVisibleCharacters="20" IsRequired="false" AutoSize="false" IsEnabled="false" IsReadOnly="false">
    <Description>Exemple : 2954A</Description>
    <Control ErrorType="error" Type="NACE" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "NACE" (https://campus.jway.eu/portal/documentation/step/2826).
