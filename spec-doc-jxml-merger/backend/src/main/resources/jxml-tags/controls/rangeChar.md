# rangeChar

Contrôler que la valeur saisie, dans une **zone de texte** ou un **champ mémo**, contient le **nombre minimum et/ou maximum de caractères** requis.

## Éléments qui l’utilisent

Le contrôle du nombre de caractères saisis est pris en charge par les éléments suivants :

- **TextBox : **utilisé pour la saisie de texte court
- **MemoBox : **utilisé pour la saisie de texte long (zone mémo)

## Paramètres

- **Min** : attribut qui définit la longueur minimale autorisée (en nombre de caractères)
Exemple : min = 5, l’utilisateur doit saisir au moins 5 caractères
- **Max** : attribut qui définit la longueur maximale autorisée (en nombre de caractères)

**Exemple** : max = 84, la saisie ne peut pas dépasser 84 caractères.

Il est possible d’utiliser **uniquement min**, **uniquement max**, ou les deux en même temps selon la contrainte souhaitée.

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">RangeChar</Label>
  <MemoBox NumberOfVisibleRows="4" RefreshOnExit="false" NumberOfVisibleCharacters="60" AutoSize="true" Name="controlOfficial|RangeChar">
    <Description>Saisie libre min=5 / max=20 : observez le message en cas de saisie erronée</Description>
    <Control Type="rangeChar" ErrorType="error">
      <Parameter Name="min" Value="5" />
      <Parameter Name="max" Value="20" />
    </Control>
  </MemoBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "rangeChar" (https://campus.jway.eu/portal/documentation/step/2831).
