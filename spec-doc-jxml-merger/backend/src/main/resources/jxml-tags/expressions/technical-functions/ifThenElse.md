# Fonction ifThenElse()

**Description** : Cette fonction implémente une condition ternaire du type : $(condition) ? $(resultTrue) : $(resultFalse). renvoie $(resultTrue si condition vraie sinon renvoie $(resultFalse).
Elle renvoie resultTrue si la condition est vraie, sinon resultFalse

**Syntaxe **: ifThenElse(**Boolean**, **Variable**, **Variable**) retourne une valeur de type **Object**

**Paramètre[1]** : **Boolean **: Condition à tester

**Paramètre[2]** : **Variable** : Valeur renvoyée si la condition est vraie

**Paramètre[3] **: **Variable **: Valeur renvoyée si la condition est fausse

**Exemple** : ifThenElse($(age) >= 18, 'Majeur', 'Mineur')

**Résultat **: Retourne "Majeur" si la variable *age* est supérieure ou égale à 18, sinon "Mineur"

Source : documentation JWAY Campus, page "Technical Functions" (https://campus.jway.eu/portal/documentation/step/2844).
