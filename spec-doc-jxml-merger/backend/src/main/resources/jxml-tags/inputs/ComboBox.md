# ComboBox

Affiche une liste déroulante dans un formulaire. C'est un champ de saisie fermé : la liste des choix peut être définie manuellement avec des `Option`, ou alimentée automatiquement par une `OptionData` issue d'une source de données.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `DataType` | Liste | Type de données de l'élément : `String`, `Double`, `Integer` |
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `DefaultValue` | Expression | Valeur par défaut du champ si aucune entrée n'est effectuée |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |

## Remarques

Il est recommandé d'utiliser un `ComboBox` pour une liste de plus de 10 options au choix.

## Exemple de code JXML

```xml
<Question StyleName="inputRight">
  <Label IsTooltipOnly="false">Choisir une tranche d'âge (ans)</Label>
  <ComboBox Name="MyAge" RefreshOnExit="false" DataType="string">
    <Option Value="0-4">0-4</Option>
    <Option Value="5-9">5-9</Option>
    <Option Value="10-14">10-14</Option>
  </ComboBox>
</Question>
```

Source : documentation JWAY Campus, page "ComboBox" (https://campus.jway.eu/portal/documentation/step/2785).
