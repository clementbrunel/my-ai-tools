# SignatureBox

Élément qui permet d'insérer un champ de signature électronique dans une `Question`. Se paramètre à la fois dans le formulaire, via une `SignatureBox`, et dans le processus via une `CustomAction` de type `Sign` — au préalable, la transaction `Sign` doit être configurée sur le serveur.

## Paramètres de signature

- `phoneNumber` : numéro de téléphone
- `fullName` : nom et prénom de l'utilisateur
- `email` : adresse e-mail
- `handwritten` : signature manuscrite

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Name` | — | Identifiant unique de l'élément dans un formulaire ou un datastore, saisi obligatoirement ou généré par défaut (caractères spéciaux non recommandés) |
| `Height` | — | Hauteur en pixels (dimension verticale) de l'élément sur un écran (défaut : `100`) |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `IsReadOnly` | Expression | Si l'expression est vraie, l'élément est protégé en écriture (défaut : `false`) |
| `IsRequired` | Expression | Si l'expression est vraie, la saisie du champ est obligatoire (défaut : `false`) |
| `Width` | — | Largeur en pixels (dimension horizontale) de l'élément sur un écran (défaut : `100`) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Signez dans ce champ</Label>
  <SignatureBox Name="MySignature" />
</Question>
```

## Code JXML dans le formFlow

```xml
<CustomAction Type="Sign">
  <Parameter Name="provider" Value="$(signature|provider)" />
  <Parameter Name="signatures[0]|signatory|email" Value="$(candidat|mail)" />
  <Parameter Name="signatures[0]|signatory|fullName" Value="$(candidat|identite|nom)" />
  <Parameter Name="signatures[0]|handwritten" Value="true" />
  <Parameter Name="signatures[0]|fields[0]" Value="'candidat|Signature'" />
</CustomAction>
```

Source : documentation JWAY Campus, page "SignatureBox" (https://campus.jway.eu/portal/documentation/step/2797).
