# CheckBox

Élément qui permet d'insérer un champ de saisie de type « case à cocher » dans une `Question`.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `DataType` | Liste | Type de données de l'élément : `String`, `Double`, `Integer` |
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `DefaultValue` | Expression | Valeur par défaut du champ si aucune entrée n'est saisie |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `true`) |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |
| `ValueWhenChecked` | Expression | Valeur renvoyée si la case est cochée (défaut : `true`) |
| `ValueWhenUnChecked` | Expression | Valeur renvoyée si la case n'est pas cochée (défaut : `false`) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">J'ai lu et j'approuve les conditions générales d'utilisation (CGU)</Label>
  <CheckBox Name="MyCheckBox" ValueWhenUnchecked="false" RefreshOnExit="false" ValueWhenChecked="true" DataType="boolean" />
</Question>
```

Source : documentation JWAY Campus, page "CheckBox" (https://campus.jway.eu/portal/documentation/step/2784).
