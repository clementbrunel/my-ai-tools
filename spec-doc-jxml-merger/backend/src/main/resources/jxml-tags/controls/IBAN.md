# IBAN

Contrôler la validité de la valeur saisie d’un **IBAN** (International Bank Account Number) en fonction du code pays **ISO 3166-1 alpha-2**.

## **Exemple**

- FR7630001007941234567890185

- BE68 5390 0754 7034
- LU28 0019 4006 4475 0000
- CH93 0076 2011 6238 5295 7

FR, BE, LU, CH = code pays (iso 2 lettres)

## Élément qui l’utilise

Le contrôle de validité de l’IBAN est pris en charge par l’élément TextBox, utilisé pour la saisie de valeurs alphanumériques.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">IBAN</Label>
  <TextBox Name="controlOfficial|IBAN" RefreshOnExit="false" DataType="string" NumberOfVisibleCharacters="20" IsRequired="false" AutoSize="false" IsEnabled="false" IsReadOnly="false">
    <Description>Exemple : FR7630001007941234567890185</Description>
    <Control ErrorType="error" Type="IBAN" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "IBAN" (https://campus.jway.eu/portal/documentation/step/2814).
