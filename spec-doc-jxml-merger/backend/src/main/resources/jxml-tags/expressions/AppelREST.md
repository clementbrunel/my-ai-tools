# appel REST

La modélisation d’un** service REST en JXML** permet d’appeler **une API externe** pour échanger des données avec un projet. L’élément **WebService** définit les paramètres de l’appel, la gestion des données et les conditions d’exécution.

## Modélisation JXML

Pour l'appel d’un service de **type REST**, vous devez ajouter dans le projet un élément **WebService** comme suit.

```xml
<WebService Id="RestService" Type="Rest" 
CallOnInputChangeOnly="true" StoreOutputInDatastore="false" 
Service="'https://reqres.in/api/users'" 
IsEnabled="existsAndNotEmpty($(monInput))" />
```

- **Service (expression)** : URL du service à appeler. Cette URL est dynamique et peut être alimentée par l’intermédiaire d’une variable. Cela permet d’utiliser les données issues du formulaire lors de l’appel.
- **Type **: à positionné sur Rest (comme dans l’exemple précédent).
- **CallOnInputChangeOnly** (**true **ou **false**) : Effectue l’appel uniquement si les paramètres d'entrée du service ont changé depuis le dernier appel. (information stocké dans le **DataStore **défini par **StoreOutput**).
- **StoreOutputInDatastore** (**true **ou **false**) : Indique si les données doivent être stockées dans le **DataStore **(**Draft**). Si **true**, elles sont enregistrées dans **Draft**, sinon dans **External**.
- **IsEnabled (expression)** : Permet d’activer l’appel au service seulement dans certaines conditions. Dans l’exemple, l’appel s’effectuera uniquement si la valeur donnée en entrée de ce service est non nulle (attention aux éventuels recouvrements avec **CallOnInputChange**).

Comme pour un service de **type SOAP**, l'usage de l'élément **WebService **de** type Rest** s'appuie sur un groupe de 3 fichiers (déposés dans le projet ou en ressources partagées) où ${id} correspond à l’attribut Id de l'élément **WebService **précédemment évoqué :

- APPLI.REF/common/extensions/webservice/${id}.jsontemplate.
- APPLI.REF/common/extensions/webservice/${id}.mapping.
- APPLI.REF/common/extensions/webservice/${id}.properties.

## JsonTemplate

Ce fichier permet de définir le corps de la requête qui sera envoyée au service. Le format nécessaire à l’appel doit être constitué manuellement.

**Exemple **:

```xml
<jsonTemplate>
  {"name": "<?data $(Demandeur|name)?>", "job": "<?data $(Demandeur|job)?>"}
</jsonTemplate>
```

Comme on peut le voir dans cet exemple, il est possible d’injecter des données issues du formulaire grâce à l'utilisation de **processing instructions ‘data’**.

Il est également possible de conditionner la présence de certaines parties du corps grâce à des paires de** processing instructions** if / end-if, ou d’utiliser une itération.

**Exemple avec une liste** :

```xml
<jsonTemplate>
{"liste": 
  [
    <?foreach item in $(database)?>
      { “key”:"<?data $(item|valeurCle)?>"
    <?end-foreach?>		
  ]
}
</jsonTemplate>
```

## Mapping

Ce fichier permet de définir les données à extraire de la réponse du service pour les injecter dans le **dataStore **indiqué précédemment.

**Exemple **:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mapping>
	<comment>mapping file</comment>
	<entry key="[]|codePostal">output[]|codePostal</entry>
	<entry key="[]|codeCommune">output[]|codeCommune</entry>
	<entry key="[]|nomCommune">output[]|nomCommune</entry>
	<entry key="[]|libelleAcheminement">output[]|libelleAcheminement</entry>
</mapping>
```

Pour chaque donnée que vous souhaitez ajouter dans le **dataStore**, il faut créer une **entry**.
L’attribut **key** de cette entry correspond à l’emplacement d’où la donnée sera extraite du JSON obtenu en réponse du service REST.

La **grammaire Jway** est utilisée pour les chemins de données. Toutefois, pour mapper des éléments itératifs, le symbole [ ] est utilisé afin de désigner une liste.

Exemple à l’appel de [https://apicarto.ign.fr/api/codes-postaux/communes/57240](https://apicarto.ign.fr/api/codes-postaux/communes/57240) (avec mapping ci dessus).

```xml
[
	{
		"codePostal": "57240",
		"codeCommune": "57368",
		"nomCommune": "Knutange",
		"libelleAcheminement": "KNUTANGE"
	},
	{
		"codePostal": "57240",
		"codeCommune": "57508",
		"nomCommune": "Nilvange",
		"libelleAcheminement": "NILVANGE"
	}
]
```

Donne le **DataStore **suivant :

```xml
<output>
	<item>
		<codePostal class="String">57240</codePostal>
		<codeCommune class="String">57368</codeCommune>
		<nomCommune class="String">Knutange</nomCommune>
		<libelleAcheminement class="String">KNUTANGE</libelleAcheminement>
	</item>
	<item>
		<codePostal class="String">57240</codePostal>
		<codeCommune class="String">57508</codeCommune>
		<nomCommune class="String">Nilvange</nomCommune>
		<libelleAcheminement class="String">NILVANGE</libelleAcheminement>
	</item>
</output>
```

## Properties

Ce fichier sert à définir les **headers** et les **paramètres** à utiliser lors de l'appel du service.
Comme pour le fichier **JsonTemplate**, il est possible d’utiliser des **processing instructions** pour injecter des données issues du formulaire.

```xml
<?xml version="1.0" encoding="utf-8"?>
<properties>
  <headers>
	  <entry key="Accept-Encoding">UTF-8</entry>
	  <entry key="Content-Type">application/json</entry>
	  <entry key="User-Agent">FormPublisher4.0</entry>
  <!-- exemple autorisation basic -->
	  <entry key="Authorization">Basic Y2hyaXN0b3Bosfdsfsdfqsd==66</entry>
  </headers>
  <request>
    <entry key="Method">POST</entry>
  </request>
</properties>
```

La partie **headers** sert à ajouter des en-têtes HTTP, notamment le header d’authentification pour un cas d’authentification **Basic** ou **JWT**.
Dans la partie **request**, l’entrée **Method** est utilisée pour définir le type d’appel (**PUT**, **GET**, **POST**, etc.).

## Sécurisation des services

Pour définir une sécurisation particulière à appliquer lors de l’utilisation **d’un service REST**, il faut ajouter un paramètre directement au niveau de l’élément **WebService**.

```xml
<Parameter Name=”IRestSecurity” Value=”XXXX.java” />
```

${id} correspond à l’identifiant du **WebService**, et XXXX au nom du filtre de sécurité qui sera ajouté.

Le **filtre de sécurité Java** est ajouté dans le répertoire suivant :
APPLI.REF/common/extensions/lu/jway/rest/
sous le nom : XXXXXXSecurityFilter.java

Ce filtre de sécurité permet d’effectuer des manipulations de données sur le **header** ou le **body** de la requête émise.

```xml
/*=======================================================*/
package lu.jway.rest;

import lu.jway.webapp.ds.DataStore;
import lu.jway.webapp.jil.JilRecord;

import java.util.HashMap;
import java.util.Map;

public class XXXXX{

    Map<String, String> getHeaders(JilRecord parameters, DataStore[] dataStores) {
        return new HashMap<>();
    }

     String enrichBody(JilRecord parameters, String body, DataStore[] dataStores) {
        return body;
    }
}
/*=======================================================*/
```

## Exemples et ressources

[Projet exemple](https://git.formsolution.dev/exemple/FormulaireExemple/-/tree/main/WebServiceRest)

Source : documentation JWAY Campus, page "appel REST" (https://campus.jway.eu/portal/documentation/step/2855).
