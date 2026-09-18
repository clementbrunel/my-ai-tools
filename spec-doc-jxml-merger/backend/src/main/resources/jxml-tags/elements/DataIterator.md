# DataIterator

C'est un objet permettant de traiter séquentiellement les éléments d'une collection sans avoir à connaître la structure interne de celle-ci. Il permet de parcourir, lire, créer, collecter, charger, stocker ou récupérer les éléments d'une liste, d'un tableau ou d'une source de données. Il est possible d'avoir une double ou une triple itération en fonction des contraintes d'un projet donné.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `DataPath` | Variable | Chemin d'accès dynamique qui permet de localiser et de référencer des éléments spécifiques dans une collection |
| `AddInsert` | Expression | Si l'expression est vraie, un bouton d'itération des lignes de données est affiché (défaut : `false`) |
| `Counter` | String | Nom de la variable qui stocke temporairement le numéro de chaque ligne courante pendant l'itération (défaut : `0`) |
| `InternalName` | String | Nom de la variable qui stocke temporairement chaque ligne courante pendant l'itération (défaut : `item`) |
| `MaxItemAllowed` | Expression | Expression qui définit le nombre maximum d'itérations autorisées |
| `MinItemAllowed` | Expression | Expression qui définit le nombre minimum d'itérations autorisées |
| `MinItemToDisplay` | Liste ouverte | Définit le nombre minimum d'itérations à l'initialisation (défaut : `1`) |
| `MinItemToPrint` | Liste ouverte | Définit le nombre minimum d'itérations sur un PDF |

## Remarques

Afin de pouvoir gérer la suppression d'éléments, vous pouvez ajouter un `IteratorControlButton` `[Type="delete"]`. À noter que, pour respecter l'accessibilité, vous devez inclure un libellé relatif à l'item dans le texte du bouton (cf. exemple : ici, le numéro de l'item).

## Exemple de code JXML

```xml
<Section Type="standard" OutputMode="all" OutputTarget="all" NewPage="screen" IsVisible="">
  <Title>DataIterator (AddInsert)</Title>
  <Content OutputMode="all" OutputTarget="all" NewPage="none">
    <DataIterator AddInsert="true" DataPath="ENFANTS" InternalName="item" MaxItemAllowed="5" MinItemAllowed="1" Counter="countitem" />
    <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Enfant n°<Data Expression="$(countitem)+1" TradId="" /></Paragraph>
    <QuestionSet OutputMode="all" LabelHorizontalAlignment="left" LabelPosition="auto" Spacing="normal" OutputTarget="all" HorizontalAlignment="left" StyleName="fieldset">
      <Question>
        <Label IsTooltipOnly="false">Nom</Label>
        <TextBox Name="item|Nom" RefreshOnExit="false" NumberOfVisibleCharacters="30" DataType="string" AutoSize="false" />
      </Question>
      <Question>
        <Label IsTooltipOnly="false">Prénom</Label>
        <TextBox Name="item|Prenom" RefreshOnExit="false" NumberOfVisibleCharacters="30" DataType="string" AutoSize="false" />
      </Question>
    </QuestionSet>
    <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all" HorizontalAlignment="right"><IteratorControlButton Type="delete">Supprimer</IteratorControlButton><IteratorControlButton Type="insertAfter">Ajouter après</IteratorControlButton></Paragraph>
  </Content>
</Section>
```

Source : documentation JWAY Campus, page "DataIterator" (https://campus.jway.eu/portal/documentation/step/2858).
