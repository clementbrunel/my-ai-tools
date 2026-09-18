# NextStep

C'est l'étape qui s'exécute aussitôt après la complétion de l'étape courante. C'est un pointeur logique qui assure la progression du flux du processus ou du `FormFlow` (`workflow`).

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `StepName` | String | Nom et identifiant unique de l'étape suivante du processus |
| `DocumentId` | String | Identifiant unique qui pointe vers le document spécifique associé au traitement de l'étape suivante du processus |
| `ToDate` | Expression | Si l'expression est vraie, la durée de traitement est déclenchée et activée (défaut : `false`) |
| `WorkflowStatus` | String | Indique l'étape actuelle du processus. Exemple : validé, rejeté, terminé |

## Remarques

Par défaut, la durée de traitement est désactivée. Lorsqu'elle est activée, elle contraint l'agent à traiter un dossier dans un délai défini.

## Exemple de code JXML

```xml
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
```

Source : documentation JWAY Campus, page "NextStep" (https://campus.jway.eu/portal/documentation/step/2874).
