# OptionData

L'élément `OptionData` génère dynamiquement une liste d'options à partir d'une source de données. Il facilite la création de longues listes de choix et leur mise à jour.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `DataPath` | Variable | Définit le chemin d'accès à la source de données |
| `FieldForValue` | | Pointe le champ de la source de données utilisé pour alimenter la valeur interne |
| `FieldForIcon` | | Pointe le champ de la source de données utilisé pour alimenter l'icône |
| `FieldForLabel` | | Pointe le champ de la source de données utilisé pour alimenter le label |
| `IsVisible` | Expression | Si l'expression est vraie, alors l'élément est présent (défaut : `true`) |

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">email</Label>
  <ComboBox Name="Liste|email" RefreshOnExit="true" IsReadOnly="" IsRequired="false" DataType="string">
    <Option Value="{null}">Sélectionner votre adresse email</Option>
    <OptionData DataPath="STUDENT" FieldForValue="email" FieldForLabel="email" />
  </ComboBox>
</Question>
```

Source : documentation JWAY Campus, page "OptionData" (https://campus.jway.eu/portal/documentation/step/2920).
