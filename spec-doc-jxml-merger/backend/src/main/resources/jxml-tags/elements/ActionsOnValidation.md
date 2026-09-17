# ActionsOnValidation

Actions à la validation du formulaire. Cet élément permet de définir les opérations automatiques qui s'exécutent quand le formulaire est validé.

## Quelques actions usuelles

- **Mise à jour du système** : sauvegarder les données validées dans le `dataStore`, mettre à jour un état, ou déclencher d'autres processus
- **Progression du flux** : permettre au processus de passer à l'étape suivante uniquement si toutes les vérifications nécessaires sont réussies (`NextStep`)
- **Traitement des données** : déclencher le traitement des données correctes et utilisables, génération de documents PDF (`Report`)
- **Notifications** : informer les utilisateurs ou alerter les autres systèmes (`Mail`)
- **Retour utilisateur** : afficher un message de succès à l'utilisateur, rediriger vers une autre page (`CustomAction`)

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `IsEnabled` | Expression | Si l'expression est vraie, l'élément est activé (défaut : `true`) |

## Exemple de code JXML

Code JXML d'une étape qui ne contient qu'un seul élément `ActionsOnValidation` dans lequel un élément `Mail` est paramétré pour notifier à la validation du formulaire de l'accusé d'enregistrement.

```xml
<Step Name=" ">
<ActionsOnValidation>
  <Mail>
    <From><EmailAddress>AdresseEmeteur</EmailAddress><Name>NomEmmeteur</Name></From>
    <To><EmailAddress>AdresseCible</EmailAddress><Name>NomCible</Name></To>
    <Subject>SujetMail</Subject>
    <Body>
      <TextBlock>Bonjour</TextBlock>
      <TextBlock>Nous vous informons que votre demande …</TextBlock>
      <TextBlock>La confirmation du traitement de votre demande vous ...</TextBlock>
      <TextBlock>...</TextBlock>
    </Body>
  </Mail>
  </ActionsOnValidation>
 </Step>
```

Source : documentation JWAY Campus, page "ActionsOnValidation" (https://campus.jway.eu/portal/documentation/step/2866).
