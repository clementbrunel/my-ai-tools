# Resources

Contient les éléments périphériques du formulaire (`MetaContent`, `MetaField`).

## Remarques

Ne pas confondre `Resources` avec le répertoire "Ressources" (répertoire des blocs communs dans un environnement FormPublisher). Ici, il s'agit de l'élément `Resources` utilisé dans un document pour regrouper les éléments `Meta*`.

## Exemple de code JXML

```xml
<Resources>
  <MetaFields Name="organisation">
    <MetaField Name="application">Texte</MetaField>
  </MetaFields>
  <MetaContent Type="validation">
    <Title>Validation</Title>
    <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">Texte</Paragraph>
    <WebService
      Id="33f2-82ef-6449"
      Type="Soap"
      CallOnInputChangeOnly="true"
      StoreOutputInDatastore="true"
    />
  </MetaContent>
</Resources>
```

Source : documentation JWAY Campus, page "Resources" (https://campus.jway.eu/portal/documentation/step/2778).
