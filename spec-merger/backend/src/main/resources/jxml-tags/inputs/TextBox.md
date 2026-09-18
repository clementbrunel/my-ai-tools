# TextBox

Élément qui permet d'insérer un champ de saisie textuelle dans une `Question`.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `DataType` | Liste | Type de données de l'élément : `String`, `Double`, `Integer` |
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `AutoSize` | Bouton | Adapte l'affichage de l'élément à la largeur de l'écran (défaut : `false`) |
| `DefaultValue` | Expression | Valeur par défaut du champ si aucune entrée n'y est effectuée |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `MaxNumberOfCharacters` | Liste ouverte | Nombre maximum de caractères à saisir dans l'élément |
| `NumberOfVisibleCharacters` | Liste ouverte | Nombre de caractères visibles de l'élément |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Saisissez votre nom</Label>
  <TextBox RefreshOnExit="false" NumberOfVisibleCharacters="40" DataType="string" AutoSize="false" Name="MyText" />
</Question>
```

Source : documentation JWAY Campus, page "TextBox" (https://campus.jway.eu/portal/documentation/step/2799).
