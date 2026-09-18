# Variable

L'élément `Variable` est un conteneur nommé utilisé pour stocker une valeur. Il permet l'évaluation d'une expression via l'attribut `Expression`. La valeur obtenue reste accessible via l'attribut `Name` au besoin. Contrairement à l'élément `Data`, l'élément `Variable` n'affiche rien.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Expression` | Requis | Combinaison de valeurs, de variables, d'opérateurs et de fonctions qui renvoie une valeur |
| `Name` | Requis | Identifiant unique de l'élément dans un formulaire ou dans un datastore (caractères spéciaux non recommandés) |
| `DataType` | Liste | Type de valeur que la variable peut stocker (`String`, `Integer`, `Double`) |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |
| `Submit` | Bouton | Permet d'enregistrer la `Variable` dans le datastore (défaut : `false`) |
| `TradId` | | Attribut technique (ne pas modifier) |

## Exemple de code JXML

```xml
<Section Type="standard" OutputMode="all" OutputTarget="all" NewPage="screen">
  <Title>Variable</Title>
  <Content OutputMode="all" OutputTarget="all" NewPage="none">
    <Variable Expression="$(ETUDIANTS[0]|nom)" Submit="false" DataType="object" Name="NOM" />
  </Content>
</Section>
```

Source : documentation JWAY Campus, page "Variable" (https://campus.jway.eu/portal/documentation/step/2925).
