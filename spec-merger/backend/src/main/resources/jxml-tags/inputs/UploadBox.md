# UploadBox

Élément qui permet d'insérer un champ de saisie pour les pièces jointes dans une `Question`. La pièce jointe chargée dans le formulaire est numérisée puis stockée de manière permanente dans le datastore après le téléversement.

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
   <Label IsTooltipOnly="false">Charger une photo au format pièce d'identité</Label>
   <UploadBox Name="MyUpload" RefreshOnExit="false" NumberOfVisibleCharacters="20" AutoSize="false">
     <Control Type="logical" ErrorType="error" />
   </UploadBox>
</Question>
```

Source : documentation JWAY Campus, page "UploadBox" (https://campus.jway.eu/portal/documentation/step/2801).
