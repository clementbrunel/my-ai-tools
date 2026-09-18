# SelectorData

Contrôler la saisie par récupération de données avec SelectorData

## Élément qui l’utilise

- **TextBox** : pour la saisie de texte court

## Paramètres

- **DataPath** : nom de la structure de données (**table**) à laquelle la sélection est liée
- **Group** : identifiant du groupe qui relie les variables concernées par cette sélection
- **FieldMap** : nom du champ de la structure dont la valeur sera reprise dans le champ courant

## Remarques

Pour utiliser **selectorData**, il faut au préalable :

- Définir une table de données
- Paramétrer une requête liée à cette table dans **FormServices**
- Poser une **DataRequest **correspondante dans le projet
- Les champs de récupération des données situés sur la même ligne doivent utiliser le contrôle selectorField, associé aux paramètres group et **fieldMap**

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false" TradId="4">Email</Label>
  <TextBox RefreshOnExit="true" DataType="string" Name="communesen" NumberOfVisibleCharacters="15" AutoSize="false">
    <Control Type="selectorData" ErrorType="error">
      <Parameter Name="dataPath" Value="Etudiants" />
      <Parameter Name="group" Value="grp_email" />
      <Parameter Name="fieldMap" Value="email" />
    </Control>
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "SelectorData" (https://campus.jway.eu/portal/documentation/step/2836).
