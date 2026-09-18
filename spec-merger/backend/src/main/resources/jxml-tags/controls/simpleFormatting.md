# simpleFormatting

Permet de formater la valeur saisie dans un champ selon une structure prédéfinie.

## Éléments qui l’utilisent

- **TextBox** : Pour la saisie de texte court
- **MemoBox** : Pour la saisie de texte long

## Paramètres du contrôle

Le paramètre **format** définit la combinaison attendue de caractères dans le champ, chaque symbole représentant un type précis (**chiffre**, **lettre ou caractère libre**).

- **Symbole # :** Représente un chiffre (**0 à 9**)
- **Symbole x :** Représente une lettre **(A à Z, a à z**)
- **Symbole * :** Représente n’importe quel caractère
- **Exemple :** **xxx####** attend trois lettres suivies de quatre chiffres

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">SimpleFormatting</Label>
  <TextBox Name="controlText|simpleFormatting" RefreshOnExit="false" DataType="string" NumberOfVisibleCharacters="20" IsRequired="true" AutoSize="false" IsEnabled="" IsReadOnly="">
    <Description>Tapez : 8T et AB8T68 apparaîtra</Description>
    <Control ErrorType="error" Type="simpleFormatting">
      <Parameter Name="format" Value="AB#x68" />
    </Control>
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "simpleFormatting" (https://campus.jway.eu/portal/documentation/step/2838).
