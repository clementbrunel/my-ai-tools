# regExp

Permet de contrôler la validité d’une chaîne de caractères saisie en fonction d’une **expression régulière** définie dans le paramètre **regExp**

## Éléments qui l’utilisent

- **TextBox** : Pour la saisie de texte court
- **MemoBox** : Pour la saisie de texte long
- **Control regExp **: Applique la vérification de conformité avec l’expression régulière

## Paramètres

- **RegExp** : L’expression régulière à appliquer
- **ErrorType** :**Error **: Bloque la validation**Warning **: Signale sans bloquer
- **OnErrorMessage** (**optionnel**) : Permet de personnaliser le message affiché à l’utilisateur

## Exemple de code JXML

(**Exemple** : « Ici, l’expression **^[^0-9]{1,}$** interdit les chiffres dans la saisie. »)

```xml
<Question>
  <Label IsTooltipOnly="false">regExp</Label>
  <TextBox Name="controlText|regExp" RefreshOnExit="false" DataType="string" NumberOfVisibleCharacters="20" IsRequired="false" AutoSize="false" IsEnabled="" IsReadOnly="">
    <Description>Saisissez une chaîne sans chiffre</Description>
    <Control ErrorType="error" Type="regExp">
      <Parameter Name="regExp" Value="^[^0-9]{1,}$" />
    </Control>
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "regExp" (https://campus.jway.eu/portal/documentation/step/2835).
