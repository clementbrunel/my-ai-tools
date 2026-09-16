# ListBox

Élément qui permet d'insérer une liste de sélection dans une `Question`. Autorise la sélection multiple ou unique selon la valeur de l'attribut `MultiValues`.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `DataType` | Liste | Type de données de l'élément : `String`, `Double`, `Integer` |
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `AutoSize` | Bouton | Adapte l'affichage de l'élément à la largeur de l'écran (défaut : `false`) |
| `DefaultValue` | Expression | Valeur par défaut du champ si aucune entrée n'est saisie |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `NumberOfVisibleRows` | Liste ouverte | Nombre de lignes à afficher (défaut : un par ligne) |
| `MultiValues` | Liste | Méthode de sélection multiple des valeurs : `Select`, `Checkbox`, `No` (défaut : `Select`) |
| `OptionsPerLine` | — | Nombre d'éléments à afficher par ligne (défaut : un par ligne) |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false" TradId="11">Vous pouvez choisir plusieurs jours dans la semaine</Label>
  <ListBox DataType="string" MultiValues="checkbox" Name="MyListCheckBox" NumberOfVisibleRows="4" OptionsPerLine="1" RefreshOnExit="false">
    <Option TradId="12" Value="Lundi">Lundi</Option>
    <Option TradId="13" Value="Mardi">Mardi</Option>
    <Option Value="Dimanche">Dimanche</Option>
  </ListBox>
</Question>
```

Source : documentation JWAY Campus, page "ListBox" (https://campus.jway.eu/portal/documentation/step/2790).
