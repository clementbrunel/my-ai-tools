# Control

L'élément `Control` permet de définir une règle de validation sur une zone de saisie (Box) afin de vérifier la conformité des données entrées. Il garantit la fiabilité des informations collectées en appliquant automatiquement les contrôles prévus par les spécifications fonctionnelles.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Type` | Liste fermée | Choix du contrôle de saisie ou de l'assistant à appliquer sur la Box parente (voir les fiches sous `controls/` pour la liste des valeurs possibles, ex. `IBAN`, `RangeDate`, `regExp`, ...) |
| `ErrorType` | Liste fermée | Choix du type d'erreur de saisie : `Error` (anomalie bloquante, empêche le système de poursuivre le processus) ou `Warning` (alerte, le système peut poursuivre le processus) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Date du jour</Label>
  <DateBox Name="DateJour" RefreshOnExit="false" IsReadOnly="false" IsRequired="false" Format="form">
    <!--Validation de la date saisie si elle est postérieure ou égale à la date courante-->
    <Control Type="RangeDate" ErrorType="error">
      <Parameter Name="min" Value="getDate()" />
    </Control>
  </DateBox>
</Question>
```

Source : documentation JWAY Campus, page "Control" (https://campus.jway.eu/portal/documentation/step/2884).
