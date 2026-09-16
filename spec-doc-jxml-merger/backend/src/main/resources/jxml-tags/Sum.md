# Sum

Contrôle permettant de valider automatiquement la **somme des valeurs saisies** dans les champs d’un même groupe (**SumGroup**). La somme est calculée et affichée dans un champ dédié, généralement en lecture seule.

## Éléments qui l’utilisent

- **NumberBox** : Permet de saisir une valeur numérique entière ou décimale, avec la possibilité de définir le nombre de décimales autorisées via le paramètre **FractionDigits**
- **CurrencyBox** : Permet de saisir un montant monétaire en tenant compte du format de devise et du nombre de décimales, avec une validation adaptée aux valeurs financières

## Paramètres

- **Group** : Identifie le groupe de champs dont les valeurs doivent être additionnées

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false" TradId="35">Nombre1</Label>
  <NumberBox AutoSize="false" DefaultValue="" FractionDigits="0" Name="Nombre1" NumberOfVisibleCharacters="15" RefreshOnExit="true" SumGroup="A1">
    <Description>Nombre1</Description>
  </NumberBox>
</Question>

<Question>
  <Label IsTooltipOnly="false" TradId="36">Nombre2</Label>
  <NumberBox AutoSize="false" DefaultValue="" FractionDigits="0" Name="Nombre2" NumberOfVisibleCharacters="15" RefreshOnExit="true" SumGroup="A1">
    <Description>Nombre2</Description>
  </NumberBox>
</Question>

<Question>
  <Label IsTooltipOnly="false" TradId="39">Somme</Label>
  <NumberBox AutoSize="false" FractionDigits="0" IsReadOnly="true" Name="SommeN" NumberOfVisibleCharacters="15" RefreshOnExit="true">
    <Description>Somme</Description>
    <Control ErrorType="error" Type="sum">
      <Parameter Name="group" Value="A1" />
    </Control>
  </NumberBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "Sum" (https://campus.jway.eu/portal/documentation/step/2840).
