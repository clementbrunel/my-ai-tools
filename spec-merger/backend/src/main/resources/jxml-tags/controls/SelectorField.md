# SelectorField

Contrôler la validité du champ courant en le renseignant à partir d’une valeur sélectionnée dans une structure de données.

## Éléments qui l’utilisent

- TextBox : pour la saisie de texte court

## Paramètres

- **Group** : identifie les variables concernées par cette sélection et les relie au **selectorData**
- **FieldMap** : nom du champ de la sélection dont la valeur sera reprise dans le champ courant

## Exemple de code JXML

```xml
<TextBox IsRequired="false" RefreshOnExit="true" DataType="string" IsReadOnly="false" Name="Nom" NumberOfVisibleCharacters="15" AutoSize="false">
  <Control Type="selectorField" ErrorType="error">
    <Parameter Name="group" Value="grp_email" />
    <Parameter Name="fieldMap" Value="nom" />
  </Control>
</TextBox>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "SelectorField" (https://campus.jway.eu/portal/documentation/step/2837).
