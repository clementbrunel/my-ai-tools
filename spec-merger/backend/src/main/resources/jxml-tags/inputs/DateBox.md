# DateBox

Élément qui permet d'insérer un champ de saisie de type date dans une `Question`.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `DefaultValue` | Expression | Valeur par défaut du champ si aucune entrée n'est saisie |
| `Format` | Liste | Mode de présentation du calendrier : `Form`, `Browser` (défaut : `Form`) |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Date de naissance</Label>
  <DateBox RefreshOnExit="false" Name="DateNaissance" Format="form">
    <Description>Date de naissance</Description>
  </DateBox>
</Question>
```

Source : documentation JWAY Campus, page "DateBox" (https://campus.jway.eu/portal/documentation/step/2787).
