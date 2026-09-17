# Fonction sortList()

**Description **: Cette fonction retourne une liste triée par ordre alphabétique.

**Syntaxe : **sortList(**string[ ]**) retourne une liste de type **string[ ]**

**Paramètre[1] **: **string[ ]** : Tableau de chaînes de caractères à trier

**Exemple **: 
list[0]='January'; 
list[1]='February'; 
list[2]='March'; 
listS=sortList($(list))

**Description** : Cette fonction retourne une liste triée par ordre alphabétique en fonction d'un élément.

**Syntaxe **: sortList(**Object[ ]**, **String**) retourne une liste de type **Object[ ]**

**Paramètre[1**] : **Object[ ]** : Tableau de records à trier

**Paramètre[2] **: **String** : Chaîne de caractères indiquant l'élément sur lequel se fera le tri

**Exemple **:

list[0]|month='January';

list[1]|month='February';

list[2]|month='March';

listS=sortList($(list),'month')

Source : documentation JWAY Campus, page "Array Functions" (https://campus.jway.eu/portal/documentation/step/2845).
