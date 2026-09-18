# TimeBox

Élément qui permet d'insérer un champ de saisie du format horaire (`HH:MM`).

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `AutoSize` | Bouton | Adapte l'affichage de l'élément à la largeur de l'écran (défaut : `false`) |
| `DefaultValue` | Expression | Valeur par défaut du champ si aucune entrée n'est effectuée |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |

## Remarques

Le format de temps utilisé est le format 24h (de 00:00 à 23:59).

## Exemple de code JXML

```xml
<Question>
   <Label IsTooltipOnly="false">Quelle est votre heure de départ ?</Label>
   <TimeBox RefreshOnExit="false" Name="MyTimeBox" />
</Question>
```

Source : documentation JWAY Campus, page "TimeBox" (https://campus.jway.eu/portal/documentation/step/2800).
