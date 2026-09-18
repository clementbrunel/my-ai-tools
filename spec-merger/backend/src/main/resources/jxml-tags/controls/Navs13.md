# Navs13

Contrôler la validité **des** **numéros AVS** (assurance vieillesse et survivants) suisses à 13 chiffres.

## Élément qui l’utilise

Le contrôle de validité **du numéro AVS** est pris en charge par l’élément **TextBox**, utilisé pour la saisie de valeurs numériques.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">NAVS 13</Label>
  <TextBox Name="controlOfficial|NACE" RefreshOnExit="false" DataType="string" NumberOfVisibleCharacters="20" IsRequired="false" AutoSize="false" IsEnabled="false" IsReadOnly="false">
    <Description>NAVS 13</Description>
    <Control ErrorType="error" Type="Navs13" />
  </TextBox>
</Question>
```

## Mode flow

Source : documentation JWAY Campus, page "Navs13" (https://campus.jway.eu/portal/documentation/step/2827).
