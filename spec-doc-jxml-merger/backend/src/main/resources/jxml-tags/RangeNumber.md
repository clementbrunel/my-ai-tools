# RangeNumber

Vérifier que la valeur saisie est comprise entre une borne minimale et/ou maximale, grâce à l’ajout d’un contrôle de type **RangeNumber **directement à l’intérieur de l’élément concerné.

## Éléments qui l’utilisent

- **NumberBox** : associé à la saisie d’un nombre entier
- **CurrencyBox** : associé à la saisie d’un montant monétaire
- **Control RangeNumber **: permet d’appliquer la vérification des bornes min/max

## Paramètre (du contrôle)

- **Min** : valeur numérique minimale autorisée
- **Max** : valeur numérique maximale autorisée
- **ErrorType** :**error** : bloque la validation**warning **: signale sans bloquer
- **OnErrorMessage** (**optionnel**) : personnalise le message affiché à l’utilisateur

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">RangeNumber</Label>
  <NumberBox IsRequired="false" IsEnabled="" RefreshOnExit="false" NumberOfVisibleCharacters="20" AutoSize="false" IsReadOnly="" Name="controlText|rangeNumber" FractionDigits="0">
    <Description>Saisie d'un nombre compris entre le min 10 / max 20</Description>
    <Control Type="RangeNumber" ErrorType="error">
      <Parameter Name="min" Value="10" />
      <Parameter Name="max" Value="20" />
    </Control>
  </NumberBox>
</Question> 
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "RangeNumber" (https://campus.jway.eu/portal/documentation/step/2834).
