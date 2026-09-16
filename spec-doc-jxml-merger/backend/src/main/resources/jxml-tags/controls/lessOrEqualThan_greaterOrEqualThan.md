# lessOrEqualThan (Inférieur ou égal à) greaterOrEqualThan (Supérieur ou égal à)

Contrôler si le nombre est inférieur ou égal à tous les nombres du même group portant le contrôle **greaterOrEqualThan**.

## Éléments qui l’utilisent

Le contrôle des comparaisons numériques (inférieur/égal, supérieur/égal) est pris en charge par les éléments suivants :

- **NumberBox** : Utilisé pour la saisie de nombres
- **CurrencyBox** : Utilisé pour la saisie de montants monétaires

## Paramètres

- **Group** : Paramètre qui permet de relier les nombres à comparer
- **Format** : Paramètre qui permet d’afficher une chaîne de caractères suivant une structure définieLes chiffres sont représentés par le caractère **#** (**dièse**)Les lettres sont représentées par le caractère **x**Le caractère ***** indique n’importe quel caractère

## Exemple de code JXML - lessOrEqualThan

```xml
 <!-- lessOrEqualThan -->
<Question>
  <Label IsTooltipOnly="false">lessOrEqualThan</Label>
  <NumberBox IsRequired="false" IsEnabled="false" RefreshOnExit="true" NumberOfVisibleCharacters="20" AutoSize="false" IsReadOnly="false" Name="controlNumber|lessOrEqualThan" FractionDigits="0">
    <Description>Nombre inférieur ou égal</Description>
    <Control ErrorType="error" Type="lessOrEqualThan">
      <OnErrorMessage>Le nombre doit être inférieur ou égal à $(controlNumber|greaterOrEqualThan)</OnErrorMessage>
      <Parameter Name="group" Value="equalCompare" />
      <Parameter Name="format" Value=",###" />
    </Control>
  </NumberBox>
</Question>  
```

## Exemple de code JXML - greaterOrEqualThan

```xml
<!-- greaterOrEqualThan -->
<Question>
  <Label IsTooltipOnly="false">greaterOrEqualThan</Label>
  <NumberBox IsRequired="false" IsEnabled="false" RefreshOnExit="true" NumberOfVisibleCharacters="20" AutoSize="false" IsReadOnly="false" Name="controlNumber|greaterOrEqualThan" FractionDigits="0">
    <Description>Nombre supérieur ou égal</Description>
    <Control ErrorType="error" Type="greaterOrEqualThan">
      <Parameter Name="group" Value="equalCompare" />
      <Parameter Name="format" Value=".####" />
    </Control>
  </NumberBox>
</Question>
```

## Mode flow

Source : documentation JWAY Campus, page "lessOrEqualThan (Inférieur ou égal à) greaterOrEqualThan (Supérieur ou égal à)" (https://campus.jway.eu/portal/documentation/step/2815).
