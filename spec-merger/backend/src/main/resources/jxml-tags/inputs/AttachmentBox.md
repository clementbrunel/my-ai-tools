# AttachmentBox

Élément qui permet d'insérer un champ de saisie de type pièce jointe dans une `Question`. Charge différents types de fichiers (documents, images, tableurs, etc.) depuis le répertoire local de l'usager vers un répertoire usager sur le serveur en ligne, sans surcharger le datastore. Seuls les liens vers les fichiers sont enregistrés dans le datastore.

## Remarques

Il faut activer au préalable le paramètre `jway.FormServices.forceCreation=true` dans le fichier de propriétés pour rendre automatique la sauvegarde des dossiers dès la création du formulaire. Sinon, la sauvegarde doit être effectuée manuellement.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Insérer une pièce</Label>
  <AttachmentBox Name="MyAttachmentBox" />
</Question>
```

Source : documentation JWAY Campus, page "AttachmentBox (Pièce à joindre)" (https://campus.jway.eu/portal/documentation/step/2802).
