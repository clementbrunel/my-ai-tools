# PasswordBox

Élément qui permet d'insérer un champ de saisie de type « mot de passe » dans une `Question`. Les caractères saisis sont masqués à l'écran par des astérisques (*).

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `AutoSize` | Bouton | Adapte l'affichage de l'élément à la largeur de l'écran (défaut : `false`) |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `NumberOfVisibleCharacters` | Liste ouverte | Nombre de caractères visibles de l'élément |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Entrez un mot de passe</Label>
  <PasswordBox Name="MyPassword" RefreshOnExit="false" NumberOfVisibleCharacters="20" AutoSize="false" />
</Question>
```

Source : documentation JWAY Campus, page "PasswordBox" (https://campus.jway.eu/portal/documentation/step/2793).
