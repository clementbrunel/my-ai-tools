# Constants

Une **expression constante** correspond à un résultat fixe obtenu à partir d’une **opération intrinsèque** appliquée à des valeurs immuables. Ces opérations, natives du compilateur, constituent les bases des traitements arithmétiques, logiques et de comparaison.

## Opérations intrinsèques

- **Opérations arithmétiques**
- **Opérations logiques**
- **Opérations de comparaison**

Elles ont une influence favorable sur la performance du code puisqu’elles sont évaluées immédiatement, sans dépendre d’entrées dynamiques.

## Exemples

- **True **: Valeur booléenne représentant le vrai.**Syntaxe** : **True**
- **False **: Valeur booléenne représentant le faux.**Syntaxe** : **False**

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Choix d'une constante</Label>
  <RadioBox Name="Constants|ChoixEnfant" RefreshOnExit="true" DataType="string">
    <Option Value="0">0</Option>
    <Option Value="1">1</Option>
    <Option Value="2">2</Option>
    <Option Value="Autre">Autre</Option>
  </RadioBox>
</Question>

<!-- Vérifie si l'expression constante définie est vraie (choix égal à "Autre") et rend la question visible -->
<Question IsVisible="$(Constants|ChoixEnfant) == &quot;Autre&quot;">
  <Label IsTooltipOnly="false">Précisez</Label>
  <TextBox Name="Constants|Precisez" RefreshOnExit="false" NumberOfVisibleCharacters="30" 
  DataType="string" AutoSize="true" />
</Question>
```

Source : documentation JWAY Campus, page "Constants" (https://campus.jway.eu/portal/documentation/step/2847).
