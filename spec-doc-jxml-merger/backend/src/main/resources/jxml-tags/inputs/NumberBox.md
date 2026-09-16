# NumberBox

Élément qui permet d'insérer un champ de saisie numérique dans une `Question`.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `FractionDigits` | — | Nombre de décimales après la virgule (défaut : `0`). `0` = entier (ex. 123), `1` = une décimale (ex. 123,4), `2` = deux décimales (ex. 123,45) |
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `AutoSize` | Bouton | Adapte l'affichage de l'élément à la largeur de l'écran (défaut : `false`) |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `NumberOfVisibleCharacters` | Liste ouverte | Nombre de caractères visibles de l'élément |
| `RefreshOnExit` | Bouton | Rafraîchit automatiquement l'écran pour toute saisie effectuée dans le champ (défaut : `false`) |
| `SumGroup` | — | Nom du groupe utilisé pour regrouper plusieurs éléments à sommer |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Saisissez la taille de l'enfant</Label>
  <NumberBox Name="MyTaille" RefreshOnExit="false" IsReadOnly="false" IsRequired="false" FractionDigits="2" NumberOfVisibleCharacters="15" AutoSize="false">
    <Description>La valeur peut être entière ou décimale.</Description>
  </NumberBox>
</Question>
```

Source : documentation JWAY Campus, page "NumberBox" (https://campus.jway.eu/portal/documentation/step/2792).
