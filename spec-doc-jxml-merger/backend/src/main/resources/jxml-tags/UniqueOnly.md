# UniqueOnly

Permet de garantir qu’un élément (ligne/enregistrement) est **unique** dans un ensemble donné (liste, itération, tableau) en refusant tout **doublon** sur une ou plusieurs clés.

## Élément qui l’utilise

Il peut être appliqué **à tout type de champ** (**TextBox**, **NumberBox**, **DateBox**, etc.), puisqu’il ne vérifie pas le contenu d’un seul champ mais l’unicité d’une ou plusieurs valeurs dans un **ensemble** (table, itérateur, liste de saisie…).

## Paramètres

- Le paramètre **keys **indique **quelle(s) colonne(s) ou champ(s)** constituent la clé d’unicitéExemple : **email **chaque email doit être unique dans la listeExemple : **name**, **firstname **la combinaison **Nom **+ **Prénom **doit être unique

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="true">uniqueOnly</Label>
  <TextBox Name="person|firstname" RefreshOnExit="false" DataType="string" 
   NumberOfVisibleCharacters="10" IsRequired="false" AutoSize="true" IsEnabled="" IsReadOnly="">
     <Control ErrorType="error" Type="uniqueOnly">
      <Parameter Name="keys" Value="name,firstname" />
     </Control> 
  </TextBox>
</Question>
```

## Mode flow

Source : documentation JWAY Campus, page "UniqueOnly" (https://campus.jway.eu/portal/documentation/step/2841).
