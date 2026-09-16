# Nbds

Contrôler la validité de la valeur saisie **d’un** **code BDS**.

## Élément qui l’utilise

Le contrôle de validité **du** **code BDS** est pris en charge par l’élément **TextBox**, utilisé pour la saisie de valeurs alphanumériques.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">BDS</Label>
  <TextBox Name="controlOfficial|NACE" RefreshOnExit="false" DataType="string" NumberOfVisibleCharacters="20" IsRequired="false" AutoSize="false" IsEnabled="false" IsReadOnly="false">
    <Description>Contrôle de validité d'un code BDS</Description>
    <Control ErrorType="error" Type="Nbds" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "Nbds" (https://campus.jway.eu/portal/documentation/step/2828).
