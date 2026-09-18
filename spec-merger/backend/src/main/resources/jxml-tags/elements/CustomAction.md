# CustomAction

Liste des actions à déclencher après validation du formulaire (`FormFlow`).

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Type` | String | Nom de la `CustomAction` insérée (voir la liste des CustomAction sur https://formsolution.jway.eu/portal/formflow.html) |
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (valeur par défaut : `true`) |

## Remarques

Une fois le formulaire validé par l'usager, l'action est déclenchée, qu'il s'agisse d'un paiement, d'une signature ou d'une redirection vers un groupe.

## Exemple de code JXML

```xml
<Step Name="FirstStep">
  <ActionsOnValidation>
    <CustomAction Type="Payment" />
  </ActionsOnValidation>
</Step>
```

Source : documentation JWAY Campus, page "CustomAction" (https://campus.jway.eu/portal/documentation/step/2870).
