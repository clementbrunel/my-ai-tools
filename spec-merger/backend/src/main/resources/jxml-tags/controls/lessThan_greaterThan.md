# lessThan / greaterThan

Contrôler si le nombre est strictement inférieur ou supérieur à tous les nombres du même groupe portant respectivement les contrôles **greaterThan** et **lessThan**.

## Éléments qui l’utilisent

Le contrôle des comparaisons strictes (inférieur / supérieur) est pris en charge par les éléments suivants :

- **NumberBox** : Utilisé pour la saisie de nombres
- **CurrencyBox **: Utilisé pour la saisie de montants monétaires

## Paramètres

- **Group **: Paramètre qui permet de relier les nombres à comparer (comparaison stricte)
- **Format **: Paramètre qui permet d’afficher une chaîne de caractères suivant une structure définieLes chiffres sont représentés par le caractère # (dièse)Les lettres sont représentées par le caractère xLe caractère `*` indique n’importe quel caractère

Exemple de formatage d’un nombre : ####

## Exemple de code JXML - lessThan

```xml
<!-- lessThan -->
<Question>
  <Label IsTooltipOnly="false">lessThan</Label>
  <NumberBox IsRequired="false" IsEnabled="false" RefreshOnExit="true" NumberOfVisibleCharacters="20" AutoSize="false" IsReadOnly="false" Name="controlNumber|lessThan" FractionDigits="0">
    <Description>Nombre inférieur</Description>
    <Control ErrorType="error" Type="lessThan">
      <OnErrorMessage>Le nombre doit être inférieur à $(control|Number|greaterThan)</OnErrorMessage>
      <Parameter Name="group" Value="strictCompare" />
      <Parameter Name="format" Value=".##" />
    </Control>
  </NumberBox>
</Question>     
```

## **Exemple de code **JXML - **greaterThan**

```xml
<!-- greaterThan -->
<Question>
  <Label IsTooltipOnly="false">greaterThan</Label>
  <NumberBox IsRequired="false" IsEnabled="false" RefreshOnExit="true" NumberOfVisibleCharacters="20" AutoSize="false" IsReadOnly="false" Name="controlNumber|greaterThan" FractionDigits="0">
    <Description>Nombre supérieur</Description>
    <Control ErrorType="error" Type="greaterThan">
      <Parameter Name="group" Value="strictCompare" />
      <Parameter Name="format" Value=".##" />
    </Control>
  </NumberBox>
</Question>
```

## Mode flow

Source : documentation JWAY Campus, page "lessThan / greaterThan" (https://campus.jway.eu/portal/documentation/step/2816).
