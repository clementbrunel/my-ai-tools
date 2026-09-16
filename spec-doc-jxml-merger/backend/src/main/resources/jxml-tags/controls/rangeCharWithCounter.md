# rangeCharWithCounter

Vérifier que la valeur saisie dans une zone de texte (**TextBox**) ou une zone mémo (**MemoBox**) respecte le nombre minimum et/ou maximum de caractères requis. Cette vérification est réalisée en ajoutant un **contrôle de type rangeCharWithCounter **directement à l’intérieur de l’élément concerné.

## Éléments qui l’utilisent

Le contrôle du nombre de caractères saisis est pris en charge par les éléments suivants :

- **TextBox** : Utilisé pour la saisie de texte court
- **MemoBox** : Utilisé pour la saisie de texte long (zone mémo)
- Associé à un **contrôle rangeCharWithCounter**

## Paramètres (du contrôle)

- Définis dans l’élément **Control****Min** : Longueur minimale autorisée (en caractères)**Max** : Longueur maximale autorisée (en caractères)**ErrorType****Error **: Bloque la validation**Warning **: Signale sans bloquer**OnErrorMessage** (**optionnel**) : Personnalise le message affiché à l’utilisateur

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">rangeCharWithCounter</Label>
  <MemoBox Name="controlText|rangeCharCounter" RefreshOnExit="false" NumberOfVisibleRows="4" NumberOfVisibleCharacters="20" AutoSize="false" 
  IsRequired="false" IsEnabled="" IsReadOnly="">
    <Description>Saisie libre min 5 / max 20 : observez le compteur dans la box</Description>
    <Control ErrorType="error" Type="rangeCharWithCounter">
      <Parameter Name="min" Value="5" />
      <Parameter Name="max" Value="20" />
    </Control>
  </MemoBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "rangeCharWithCounter" (https://campus.jway.eu/portal/documentation/step/2832).
