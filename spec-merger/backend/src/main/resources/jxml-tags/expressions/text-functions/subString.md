# Fonction subString()

**Description **: Cette fonction retourne une chaîne de caractères correspondant à la chaîne d’origine, à partir de la position spécifiée dans le texte.

**Syntaxe **: subString(**String**, **Integer**) retourne une valeur de type **String**

**Paramètre[1**] : **String **: Chaîne de caractères à modifier ("Hello World.")

**Paramètre[2]** : **Integer **: Position de départ du découpage (le premier caractère correspond à la position 0)

**Exemple** : subString('Hello World.', 3) **Résultat **: "lo World."

**Remarque : **Dans cet exemple, la fonction renvoie la partie de la chaîne "Hello World." à partir du 4ᵉ caractère (puisque la position 0 correspond à la première lettre). Le résultat obtenu est donc "lo World.".

```xml
<Variable Expression="subString($(SubStringMot),1)" Submit="false" DataType="string" Name="SubStringMotObtenue1" />
```

**Description **: Cette fonction retourne une chaîne de caractères correspondant à une portion de la chaîne d’origine, comprise entre les positions de début et de fin spécifiées.

**Syntaxe **: subString(**String**, **Integer**, **Integer **) retourne une valeur de type **String**

**Paramètre[1] **: **String **: Chaîne de caractères à modifier ("Hello World.")

**Paramètre[2] **: **Integer **: Position de départ (le premier caractère correspond à la position 0)

**Paramètre[3] **: **Integer **: Position de fin (le caractère à cette position n’est pas inclus dans le résultat)

**Exemple **: subString('Hello World.' , 3 , 5) **Résultat **: "lo"

**Remarque **: Dans cet exemple, la fonction renvoie les caractères situés entre les positions 3 et 5 de la chaîne "Hello World.". Le caractère à la position 5 n’est pas inclus, donc le résultat est "lo".

```xml
<Variable Expression="subString($(SubStringMot),1,7)" Submit="false" DataType="object" Name="SubStringMotObtenue2" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
