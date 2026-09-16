# Logical

Permet de mettre un champ en erreur en fonction d’une expression booléenne passée en paramètre. Le champ portant le contrôle est mis en erreur si l’expression n’est pas vérifiée.

## Élément qui l’utilise

- **TextBox**

## Paramètres

- **isEnabled** : Si l’expression est vraie, l’élément est actif (valeur par défaut : true)

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">logical</Label>
  <TextBox IsRequired="false" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="false" Name="TestLogical" DataType="string">
    <Control Type="logical" ErrorType="error" />
  </TextBox>
</Question>
```

## Mode flow

Source : documentation JWAY Campus, page "Logical" (https://campus.jway.eu/portal/documentation/step/2823).
