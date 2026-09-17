# Fonction existsOrElse()

**Description **: Cette fonction renvoie une valeur si celle-ci est non vide (test via existsAndNotEmpty), sinon elle renvoie une valeur par défaut

**Syntaxe **: existsOrElse(**Variable**, **Variable**) retourne une valeur de type **Object**

**Paramètre[1] **: **Variable **: Valeur renvoyée si elle existe et n’est pas vide

**Paramètre[2]** : **Variable **: Valeur renvoyée si la première valeur est vide ou nulle

**Exemple **: existsOrElse($(nom), 'Inconnu')

**Résultat **: Retourne la valeur de *nom* si elle existe et n’est pas vide, sinon "Inconnu"

Source : documentation JWAY Campus, page "Technical Functions" (https://campus.jway.eu/portal/documentation/step/2844).
