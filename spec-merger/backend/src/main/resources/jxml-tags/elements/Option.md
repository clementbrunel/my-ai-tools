# Option

L'élément `Option` permet de créer un texte affiché et une valeur interne représentant un choix individuel sélectionnable par l'utilisateur. Il est insérable dans les éléments `ChoiceSet`, `RadioBox`, `ComboBox` et `ListBox`. Chaque option associe un texte visible à une valeur interne utilisée lors du traitement du formulaire.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Icon` | | Définit le champ de type icône |
| `IsVisible` | Expression | Si l'expression est vraie, alors l'élément est présent (défaut : `true`) |
| `TradId` | | Attribut technique (ne pas modifier) |
| `Value` | Expression | Si l'expression est vraie, alors la valeur est définie (défaut : `code`) |

## Remarques

Dans le cas d'une `ComboBox`, la première option est généralement utilisée comme texte indicatif, c'est pourquoi l'attribut `Value` est défini sur `"{null}"`.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">capsule 1</Label>
  <ComboBox Name="capsule1" RefreshOnExit="false" IsReadOnly="false" IsRequired="false" DataType="string">
    <Option Value="{null}">Sélectionner</Option>
    <Option Value="Module1">Module 1</Option>
    <Option Value="Module2">Module 2</Option>
  </ComboBox>
</Question>
```

Source : documentation JWAY Campus, page "Option" (https://campus.jway.eu/portal/documentation/step/2919).
