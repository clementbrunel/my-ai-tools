# WebService

L'élément `WebService` permet de connecter un projet JXML à un service web externe (`Rest` ou `Soap`) pour échanger des données de manière automatisée. Il définit la logique d'appel, les conditions d'exécution et le stockage des résultats.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Id` | String | Identifiant unique du service, utilisé pour nommer ses fichiers associés (`${id}.jsontemplate`/`${id}.template`, `${id}.mapping`, `${id}.properties`) |
| `Type` | Liste fermée | Type du service à appeler : `Rest` ou `Soap` |
| `Service` | Expression | (REST uniquement) URL du service à appeler ; peut être alimentée dynamiquement par une variable du formulaire |
| `CallOnInputChangeOnly` | Booléen | Si `true`, l'appel n'est effectué que si les paramètres d'entrée ont changé depuis le dernier appel (comparaison stockée dans le `DataStore` défini par `StoreOutputInDatastore`) |
| `StoreOutputInDatastore` | Booléen | Si `true`, la réponse est stockée dans le `DataStore` `Draft`, sinon dans `External` |
| `IsEnabled` | Expression | Conditionne l'exécution de l'appel (ex. uniquement si une donnée d'entrée est renseignée) |

## Remarques

Un `WebService` s'accompagne de trois fichiers associés sous `APPLI.REF/common/extensions/webservice/`, nommés à partir de son `Id` :

- Pour REST, `${id}.jsontemplate` ; pour SOAP, `${id}.template` : construit le corps de la requête envoyée au service, avec injection de données du formulaire via des processing instructions (`data`, `if`/`end-if`, `foreach`/`end-foreach`)
- `${id}.mapping` : extrait les données de la réponse du service et les injecte dans le `DataStore` (grammaire Jway pour les chemins, `[ ]` pour désigner une liste)
- `${id}.properties` : définit les headers HTTP et paramètres de l'appel (méthode, URL cible pour SOAP via `Transport`, authentification, etc.)

La sécurisation d'un appel peut être renforcée par un filtre de sécurité Java déposé dans `APPLI.REF/common/extensions/lu/jway/rest/` (REST) ou `.../lu/jway/services/security/` (SOAP), qui permet de manipuler headers/body de la requête ou de la réponse. Pour REST, le filtre est déclaré via un `Parameter Name="IRestSecurity" Value="XXXX.java"` sur l'élément `WebService` ; pour SOAP, via la propriété de publication `jway.webservice.security.${id}.classname`.

## Exemple de code JXML

```xml
<!-- Appel REST -->
<WebService Id="RestService" Type="Rest"
  CallOnInputChangeOnly="true" StoreOutputInDatastore="false"
  Service="'https://reqres.in/api/users'"
  IsEnabled="existsAndNotEmpty($(monInput))" />

<!-- Appel SOAP -->
<WebService Id="webServicePays"
  CallOnInputChangeOnly="true" StoreOutputInDatastore="true"
  Type="Soap" IsEnabled="existsAndNotEmpty($(monInput))" />
```

Source : documentation JWAY Campus, pages "appel REST" (https://campus.jway.eu/portal/documentation/step/2855) et "Appel SOAP" (https://campus.jway.eu/portal/documentation/step/2856).
