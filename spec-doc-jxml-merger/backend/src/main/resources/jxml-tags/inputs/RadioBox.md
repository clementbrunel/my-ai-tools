# RadioBox

Élément qui permet d'insérer un champ de saisie de type « bouton radio à cocher » dans une `Question`.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `DataType` | Liste | Type de données de l'élément : `String`, `Double`, `Integer` |
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `DefaultValue` | Expression | Valeur par défaut du champ si aucune entrée n'est effectuée |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `OptionsPerLine` | — | Nombre d'éléments à afficher par ligne (défaut : un par ligne) |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |

## Remarques

La `RadioBox` est une question fermée obligeant l'utilisateur à opérer un choix dans une liste définie. Recommandée pour des listes contenant au maximum 10 options visibles.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Avez-vous des enfants ?</Label>
  <RadioBox Name="MyRadioBox" RefreshOnExit="true" DataType="string">
    <Option Value="Oui">Oui</Option>
    <Option Value="Non">Non</Option>
  </RadioBox>
</Question>

<Question IsVisible="$(MyRadioBox)=='Oui'">
  <Label IsTooltipOnly="false">Nombre d'enfants</Label>
  <RadioBox Name="MyRadioBoxEnfant" RefreshOnExit="true" DataType="string" OptionsPerLine="2">
    <Option Value="1">1</Option>
    <Option Value="2">2</Option>
  </RadioBox>
</Question>
```

Source : documentation JWAY Campus, page "RadioBox" (https://campus.jway.eu/portal/documentation/step/2796).
