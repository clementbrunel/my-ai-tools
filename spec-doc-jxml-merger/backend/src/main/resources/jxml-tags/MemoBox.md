# MemoBox

Élément qui permet d'insérer un champ de saisie de type « zone de texte multiligne » dans une `Question`.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `AutoSize` | Bouton | Adapte l'affichage de l'élément à la largeur de l'écran (défaut : `false`) |
| `DefaultValue` | Expression | Valeur par défaut du champ si aucune donnée n'est saisie |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `NumberOfVisibleRows` | Liste ouverte | Nombre de lignes à afficher (défaut : 4) |
| `NumberOfVisibleCharacters` | Liste ouverte | Largeur visible de la zone de saisie en nombre de caractères |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Décrire l'entreprise</Label>
  <MemoBox Name="MyMemo" RefreshOnExit="false" IsReadOnly="false" IsRequired="false" NumberOfVisibleRows="4" NumberOfVisibleCharacters="60" AutoSize="true" />
</Question>
```

Source : documentation JWAY Campus, page "MemoBox" (https://campus.jway.eu/portal/documentation/step/2791).
