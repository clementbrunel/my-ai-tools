# Technical Functions

Ces fonctions offrent des outils de base pour la comparaison, la vérification de contenu, la génération d’identifiants ou encore l’exécution conditionnelle.
Elles permettent d’effectuer des opérations courantes telles que déterminer la valeur minimale ou maximale, tester l’existence d’une variable, ou récupérer des propriétés spécifiques d’un fichier de configuration.

## Liste des fonctions disponibles

- **min(Object, Object)** : Renvoie la valeur minimale entre deux objets
- **max(Object, Object)** : Renvoie la valeur maximale entre deux objets
- **existsAndNotEmpty(Variable)** : Vérifie si une variable existe et possède un contenu
- **callExtension(Object, String, Object...)** : Appelle une extension FormPublisher spécifique avec des arguments donnés
- **ifThenElse(Boolean, Variable, Variable)** : Retourne une valeur selon qu’une condition soit vraie ou fausse
- **existsOrElse(Variable, Variable)** : Renvoie une valeur si elle existe, sinon une valeur par défaut
- **getProperty(String)** : Récupère la valeur d’une entrée contenue dans le fichier [publication.properties](http://publication.properties/)
- **createUuid()** : Génère un identifiant unique
- **listContains(Object, String, String)** : Vérifie si une valeur donnée est contenue dans une liste de valeurs

## Fonction min()

**Description **: Cette fonction renvoie la valeur minimale entre deux objets.

**Syntaxe **: min(**Object**, **Object**) retourne une valeur de type **Object**

**Paramètre[1]** : **Object **: Variable 1 minimiser

**Paramètre[2]** : **Object **: Variable 2 minimiser

**Exemple **: min(10, 5)

**Résultat** : 5

## Fonction max()

**Description** : Cette fonction renvoie la valeur maximale entre deux objets.

**Syntaxe **: max(Object, Object) retourne une valeur de type **Object**

**Paramètre[1]** : **Object **: Variable 1 maximiser

**Parametre[2]** : **Object **: Variable 2 maximiser

**Exemple **: max(10, 5)

**Résultat** : 10

## Fonction existsAndNotEmpty()

**Description **: Cette fonction permet de savoir si une variable existe et possède un contenu.

**Syntaxe **: existsAndNotEmpty(Variable) retourne une valeur de type **Boolean**

**Paramètre[1]** : **Variable **: Variable à tester

**Exemple **: existsAndNotEmpty($(nom))

**Résultat **: True si la variable nom existe et n’est pas vide, sinon false

## Fonction callExtension()

**Description** : Cette fonction appelle la méthode call(Object... arg) de la classe FormPublisherExtension nommée %var-2%, avec les arguments %var-3% à %var-n%. Elle exécute une classe Java située dans le répertoire *.REF/common/extensions/lu/jway/extension.

**Syntaxe **: callExtension(**Object**, **String**, **Object**) retourne une valeur de type **Object**

**Paramètre[1] **: **Object **: Variable purement technique utiliser toujours la valeur : this

**Paramètre[2]** : **String **: Nom de la classe FormPublisherExtension à utiliser

**Paramètre[3] **: **Object** : liste des arguments à passer à la FormPublisherExtension

**Exemple **: callExtension(:this, 'MyCustomExtension', 'param1', 'param2')

// Appelle la classe MyCustomExtension avec les arguments param1 et param2.

## Fonction ifThenElse()

**Description** : Cette fonction implémente une condition ternaire du type : $(condition) ? $(resultTrue) : $(resultFalse). renvoie $(resultTrue si condition vraie sinon renvoie $(resultFalse).
Elle renvoie resultTrue si la condition est vraie, sinon resultFalse

**Syntaxe **: ifThenElse(**Boolean**, **Variable**, **Variable**) retourne une valeur de type **Object**

**Paramètre[1]** : **Boolean **: Condition à tester

**Paramètre[2]** : **Variable** : Valeur renvoyée si la condition est vraie

**Paramètre[3] **: **Variable **: Valeur renvoyée si la condition est fausse

**Exemple** : ifThenElse($(age) >= 18, 'Majeur', 'Mineur')

**Résultat **: Retourne "Majeur" si la variable *age* est supérieure ou égale à 18, sinon "Mineur"

## Fonction existsOrElse()

**Description **: Cette fonction renvoie une valeur si celle-ci est non vide (test via existsAndNotEmpty), sinon elle renvoie une valeur par défaut

**Syntaxe **: existsOrElse(**Variable**, **Variable**) retourne une valeur de type **Object**

**Paramètre[1] **: **Variable **: Valeur renvoyée si elle existe et n’est pas vide

**Paramètre[2]** : **Variable **: Valeur renvoyée si la première valeur est vide ou nulle

**Exemple **: existsOrElse($(nom), 'Inconnu')

**Résultat **: Retourne la valeur de *nom* si elle existe et n’est pas vide, sinon "Inconnu"

## Fonction getProperty()

**Description** : Cette fonction permet de retourner la valeur d'une entrée contenue dans le fichier 'publication.properties['](http://publication.properties/)

**Syntaxe **: getProperty(**String**) retourne une valeur de type **String**

**Paramètre[1]** : **String **: Nom de l'entrée à retourner

**Exemple** : getProperty('app.version')

**Résultat** : Retourne la valeur associée à la clé 'app.version' dans le fichier 'publication.properties'

## Fonction createUuid()

**Description **: Cette fonction permet de générer et de retourner un identifiant unique (UUID). Elle est utilisée pour créer des valeurs uniques, par exemple pour identifier un enregistrement ou un document

**Syntaxe **: createUuid() retourne une valeur de type **String**

**Exemple **: createUuid()

**Résultat** : Retourne une valeur unique, par exemple f47ac10b-58cc-4372-a567-0e02b2c3d479

## Fonction listContains()

**Description **: Cette fonction permet de vérifier si la valeur du premier paramètre est contenue parmi les valeurs suivantes

**Syntaxe **: listContains(**Object**, **String**, **String**) retourne une valeur de type **Boolean**

**Paramètre[1]** : **Object **: Variable à tester

**Paramètre[2]** : **String **: Première valeur de liste

**Paramètre[3]** : **String **: Deuxième (voire plus) valeur de liste

**Exemple **: listContains($(codePays) , 'CH', 'FR', 'DE', 'EN')

**Résultat** : Retourne true si la variable codePays correspond à l’un des codes de la liste, sinon false

Source : documentation JWAY Campus, page "Technical Functions" (https://campus.jway.eu/portal/documentation/step/2844).
