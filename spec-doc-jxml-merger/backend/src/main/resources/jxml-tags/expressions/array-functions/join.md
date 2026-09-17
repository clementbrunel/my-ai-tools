# Fonction join()

**Description **: Cette fonction permet de réaliser une jointure entre plusieurs listes à l’aide d’une expression de jointure. Elle peut accepter jusqu’à quatre listes.

**Syntaxe **: join(**String**, **Object[ ]**, **Object[ ]**) retourne une liste de type **Object[ ]**

**Paramètre[1]** : **String **: Expression acceptant les entrant suivant :

- **Opérateurs booléens** : **<=**, **>=**, **==**,** !=**, **IN**
- **Membre à vérifier** :**Littéraux **: Pour le littéral **123 **utiliser la forme **\'123\'**Variable du **dataStore** : Champ **personne|nom** sous la forme **$(personne|nom)**Champ d'une des liste : Pour le champ **nom **de la 1ere liste utiliser** a.nom**, et pour le champ **prénom **de 2eme liste utilisez **b.prénom**, etc

**Paramètre[2] **: **Object[ ]** : Liste a d'objets a joindre.
**Paramètre[3**] : **Object[ ]** : Liste b d'objets a joindre.

**Exemple **:

join('a.cle == b.cle', $(list))

// List1 : {cle=3, valeur=E}, {cle=2, valeur=Z}, {cle=1, valeur=A}

Source : documentation JWAY Campus, page "Array Functions" (https://campus.jway.eu/portal/documentation/step/2845).
