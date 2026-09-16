# BEBCE

Contrôle de la validité et du format de la valeur saisie d’un numéro d’identifiant unique d’une entreprise légale opérant en Belgique. Ce numéro est attribué par la BCE (Banque-Carrefour des Entreprises).

## Élément qui l’utilise

Ce contrôle s’emploie dans un élément de type TextBox (champ de saisie).

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">BEBCE</Label>
  <TextBox 
    Name="controlOfficial|BEBCE" RefreshOnExit="false" 
    DataType="string" NumberOfVisibleCharacters="20"  		  
    IsRequired="false" AutoSize="false" IsEnabled="" IsReadOnly="">
    <Description>Exemple : BE662589776</Description>
    <Control ErrorType="error" Type="BEBCE">
      <Parameter Name="format" Value="BE ###-###-###" />
    </Control>
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "BEBCE" (https://campus.jway.eu/portal/documentation/step/2805).
