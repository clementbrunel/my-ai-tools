# BEONSS

Contrôler la validité et le format de la valeur saisie d’un **numéro d’immatriculation** (12 chiffres) enregistré auprès de l’Office national de sécurité sociale (ONSS) de Belgique. Ce contrôle s’emploie dans un élément de type **TextBox **(champ de saisie).

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">BEONSS</Label>
  <TextBox 
    RefreshOnExit="false" 
    NumberOfVisibleCharacters="15" 
    DataType="string" 
    AutoSize="false" 
    Name="controlOfficial|BEONSS">
    <Description>Exemple : 210142791565</Description>
    <Control Type="BEONSS" ErrorType="error" />
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "BEONSS" (https://campus.jway.eu/portal/documentation/step/2807).
