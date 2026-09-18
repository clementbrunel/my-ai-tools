# ColumnDefinitions

Conteneur parent d'un tableau (`Table`) regroupant toutes les `ColumnDefinition`. Il définit la structure de la grille, son ordre et son nombre de colonnes, et centralise les caractéristiques d'affichage, comme les largeurs à l'écran et dans le PDF.

## Exemple de code JXML

```xml
<Table OutputMode="all" Spacing="normal" OutputTarget="all">
  <ColumnDefinitions>
    <ColumnDefinition Width="25%" />
    <ColumnDefinition Width="25%" />
    <ColumnDefinition Width="25%" />
    <ColumnDefinition Width="25%" />
  </ColumnDefinitions>
</Table>
```

Source : documentation JWAY Campus, page "ColumnDefinitions" (https://campus.jway.eu/portal/documentation/step/2932).
