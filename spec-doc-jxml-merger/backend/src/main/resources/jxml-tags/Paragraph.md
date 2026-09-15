# Paragraph

Élément de structure d'un bloc de texte qui permet de présenter un contenu avec plus de clarté. Chaque nouveau paragraphe implique un retour à la ligne ainsi que des marges au-dessus et en dessous.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `HorizontalAlignment` | Liste | Choix de l'alignement horizontal |
| `IsReadOnly` | Expression | Si l'expression est vraie, les éléments enfants sont visibles mais non disponibles à la saisie (défaut : `false`) |
| `IsVisible` | Expression | Si l'expression est vraie, alors l'élément est présent (défaut : `true`) |
| `OutputMode` | Liste | Le `Paragraph` sera présent en `report`, `interview` ou les deux |
| `Spacing` | Liste | Permet de varier l'espacement entre les lignes (défaut : `normal`) |
| `TradId` | — | Attribut technique (ne pas modifier) |

## Exemple de code JXML

```xml
<Section Type="standard" OutputMode="all" OutputTarget="all" NewPage="screen">
  <Title>Paragraph</Title>
  <Content OutputMode="all" OutputTarget="all" NewPage="none">
    <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Mon texte ici</Paragraph>
  </Content>
</Section>
```

Source : documentation JWAY Campus, page "Paragraph" (https://campus.jway.eu/portal/documentation/step/2777).
