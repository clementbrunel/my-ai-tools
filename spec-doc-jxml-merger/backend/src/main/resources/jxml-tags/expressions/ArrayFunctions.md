# Array Functions

Ces fonctions permettent de manipuler, trier, filtrer ou fusionner des listes de données. Elles facilitent le traitement d’ensembles d’éléments, qu’il s’agisse de listes simples (chaînes de caractères, nombres) ou de listes d’objets plus complexes. Elles sont particulièrement utiles pour ordonner, rechercher, filtrer ou combiner des données au sein d’un formulaire.

## Liste des fonctions disponibles

- **sortList(list)** : Trie une liste de chaînes de caractères par ordre alphabétique
- **sortList(list, élément)** : Trie une liste d’objets selon un champ spécifique (ex. month)
- **getSize(list)** : Retourne le nombre d’éléments contenus dans une liste
- **setSize(list, taille)** : Fixe le nombre d’éléments d’une liste et renvoie true si l’opération réussit
- **searchOccurFromList(list, clé, champCle)** : Récupère un objet de la liste correspondant à une clé donnée
- **searchValueFromList(list, clé, champCle, champValeur)** : Récupère une valeur d’un objet de la liste correspondant à une clé donnée
- **randomizeList(list)** : Mélange les éléments d’une liste dans un ordre aléatoire
- **getListFromCsv(fichier)** : Crée une liste à partir d’un fichier CSV fourni en entrée
- **filter(expression, list)** : Filtre une liste d’objets selon une condition logique donnée
- **join(expression, listA, listB)** : Effectue une jointure entre deux (ou plusieurs) listes selon une condition donnée

## Fonction sortList()

**Description **: Cette fonction retourne une liste triée par ordre alphabétique.

**Syntaxe : **sortList(**string[ ]**) retourne une liste de type **string[ ]**

**Paramètre[1] **: **string[ ]** : Tableau de chaînes de caractères à trier

**Exemple **: 
list[0]='January'; 
list[1]='February'; 
list[2]='March'; 
listS=sortList($(list))

## Fonction sortList()

**Description** : Cette fonction retourne une liste triée par ordre alphabétique en fonction d'un élément.

**Syntaxe **: sortList(**Object[ ]**, **String**) retourne une liste de type **Object[ ]**

**Paramètre[1**] : **Object[ ]** : Tableau de records à trier

**Paramètre[2] **: **String** : Chaîne de caractères indiquant l'élément sur lequel se fera le tri

**Exemple **:

list[0]|month='January';

list[1]|month='February';

list[2]|month='March';

listS=sortList($(list),'month')

## Fonction getSize()

**Description **: Cette fonction retourne le nombre d'éléments contenus dans un tableau (à une dimension).

**Syntaxe **: getSize(**String[ ]**) retourne une valeur de type **Integer**

**Paramètre[1] **: **String[ ]** : Tableau pour lequel le nombre d'éléments doit être retourné

**Exemple **:

list[0] ='January';

list[1] ='February';

list[2] ='March';

getSize($(list))

**Résultat **: 3

## Fonction setSize()

**Description **: Cette fonction permet de fixer le nombre d'éléments d'une liste et renvoie un Boolean (true si l'opération s'est déroulée correctement).

**Syntaxe **: setSize(**Value**, **Integer**) retourne une liste de type **String[ ]**

**Paramètre[1]** : **Value** : Liste qui doit être créée ou modifiée

**Paramètre[2]** : **Integer **: Taille désirée de la liste

**Exemple **:

list[0] ='January';

list[1] ='February';

list[2] ='March';

setSize($(list), 4)

## Fonction searchOccurFromList()

**Description **: Cette fonction permet de récupérer un objet de la liste correspondant à une clé fournie.

**Syntaxe **: searchOccurFromList(**Value**, **String**, **String**) retourne un objet de type **Object**

**Paramètre[1] **: **Value **: Liste dans laquelle chercher

**Paramètre[2] **: **String **: Clé à rechercher dans la liste

**Paramètre[3]** : **String **: Champ de la liste considéré comme clé

**Exemple **: searchOccurFromList($(list), '1', 'cle') // List : {cle=3, valeur=E}, {cle=2, valeur=Z}, {cle=1, valeur=A}

## Fonction searchValueFromList()

**Description **: Cette fonction permet de récupérer une valeur de la liste correspondant à une clé fournie.

**Syntaxe** : searchValueFromList(**Value**, **String**, **String**, **String**) retourne une valeur de type **String**

**Paramètre[1]** : **Value **: Liste dans laquelle chercher

**Paramètre[2] **: **String **: Clé à rechercher dans la liste

**Paramètre[3]** : **String **: Champ de la liste considéré comme clé

**Paramètre[4]** : **String **: Champ de la liste considéré comme valeur

**Exemple **: searchValueFromList($(list), '1', 'cle', 'valeur') List : {cle=3, valeur=E}, {cle=2, valeur=Z}, {cle=1, valeur=A}

## Fonction randomizeList()

**Description **: Cette fonction permet de prendre une liste et de la rendre avec un ordre de lignes aléatoire. Attention si la méthode est lancée plusieurs fois l'ordre sera différent à chaque exécution.

**Syntaxe **: randomizeList(**Object[ ]**) retourne une liste de type **Object[ ]**

**Paramètre[1]** : **Object[ ] **: Liste à randomiser

**Exemple **: randomizeList($(list))

## Fonction getListFromCsv()

**Description **: Cette fonction permet de récupérer liste sur base d'un fichier fourni en entrée.

**Syntaxe **: getListFromCsv(**String**) retourne une liste de type** Object[ ]**

**Paramètre[1] **: **String **: Nom du fichier CSV à placer dans le répertoire XX.REF/common/WEB-INF/classes

**Exemple **: getListFromCsv('monCsv.doc')

## Fonction filter()

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

## Fonction join()

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
