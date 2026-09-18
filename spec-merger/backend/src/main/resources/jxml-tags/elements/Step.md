# Step

C'est l'élément qui permet de définir une étape dans le `FormFlow` (`workflow`). Le système attribue par défaut `FirstStep` à la première étape.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Name` | String | Permet de nommer l'identifiant unique d'une étape |

## Exemple de code JXML

```xml
<Step Name="FirstStep">
  <Description>Description de l'élément parent</Description>
  <ActionsOnValidation>
    <NextStep StepName="Validation">
      <Description>Description de l'étape</Description>
      <Role Name="Validateur" />
    </NextStep>
    <Mail>
      <From>
        <EmailAddress></EmailAddress>
        <Name>NomEmmeteur</Name>
      </From>
      <To>
        <EmailAddress><Data Expression="$(Email)" /></EmailAddress>
        <Name>NomCible</Name>
      </To>
      <Subject>SujetMail</Subject>
      <Body>
        <TextBlock>Bonjour</TextBlock>
        <TextBlock>Nous vous informons que votre demande a bien été enregistrée par nos services.</TextBlock>
        <TextBlock>La confirmation du traitement de votre demande vous parviendra dans les meilleurs délais.</TextBlock>
        <TextBlock>Bien cordialement,</TextBlock>
        <TextBlock>Le responsable du service</TextBlock>
      </Body>
    </Mail>
  </ActionsOnValidation>
</Step>
```

Source : documentation JWAY Campus, page "Step" (https://campus.jway.eu/portal/documentation/step/2878).
