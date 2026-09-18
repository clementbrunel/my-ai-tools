# Fonction filter()

**Description **: Cette fonction permet de filtrer une liste d’objets selon une condition logique.

**Syntaxe **: filter(**String**, **Object[ ]**) retourne une liste de type **Object[ ]**

**Paramètre[1]** : **String **: Expression de filtrage acceptant les éléments suivants :

- **Opérateurs booléens** : **<=**,** >=**, **==**, **!=**, **IN**
- **Membre à vérifier :****Littéraux **: Pour le littéral **123 **utiliser la forme **\'123\'**Variable du **dataStore** : Champ **personne|nom** sous la forme **$(personne|nom)**Champ de la liste : Pour le champ **nom **utiliser **a.nom**

**Paramètre[2] **: **Object[]** : Liste d'objets a filtrer.

**Exemple **:

filter('a.cle >= \'2\'', $(list))

// List1 : {cle=3, valeur=E}, {cle=2, valeur=Z}, {cle=1, valeur=A}

// List2 : {cle=3, label=label3}, {cle=2, label=label2}

Source : documentation JWAY Campus, page "Array Functions" (https://campus.jway.eu/portal/documentation/step/2845).
