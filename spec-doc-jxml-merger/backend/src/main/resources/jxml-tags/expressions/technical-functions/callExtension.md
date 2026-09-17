# Fonction callExtension()

**Description** : Cette fonction appelle la méthode call(Object... arg) de la classe FormPublisherExtension nommée %var-2%, avec les arguments %var-3% à %var-n%. Elle exécute une classe Java située dans le répertoire *.REF/common/extensions/lu/jway/extension.

**Syntaxe **: callExtension(**Object**, **String**, **Object**) retourne une valeur de type **Object**

**Paramètre[1] **: **Object **: Variable purement technique utiliser toujours la valeur : this

**Paramètre[2]** : **String **: Nom de la classe FormPublisherExtension à utiliser

**Paramètre[3] **: **Object** : liste des arguments à passer à la FormPublisherExtension

**Exemple **: callExtension(:this, 'MyCustomExtension', 'param1', 'param2')

// Appelle la classe MyCustomExtension avec les arguments param1 et param2.

Source : documentation JWAY Campus, page "Technical Functions" (https://campus.jway.eu/portal/documentation/step/2844).
