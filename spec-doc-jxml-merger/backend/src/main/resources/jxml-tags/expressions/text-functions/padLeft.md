# Fonction padLeft()

**Description **: Cette fonction retourne une chaîne de caractères complétée à gauche par le caractère de remplissage indiqué, jusqu’à atteindre la longueur spécifiée. Si la chaîne d’origine est plus longue que la longueur demandée, elle est tronquée.

**Syntaxe **: padLeft( **String**, **Integer**, **Char **) retourne une valeur de type **String**

**Paramètre[1]** : **String **: Chaîne de caractères à modifier ("Hello World.")

**Paramètre[2] **: **Integer **: Longueur finale souhaitée

**Paramètre[3]** : **Char **: Caractère de remplissage ('0')

**Exemple **: padLeft('Hello World.' , 15 , '0') **Résultat **: "000Hello World."

**Remarque **: Dans cet exemple, la chaîne "Hello World." est complétée avec le caractère "0" jusqu’à atteindre une longueur totale de 15 caractères. Si la chaîne avait été plus longue que 15, elle aurait été raccourcie pour correspondre à cette longueur.

```xml
<Variable Expression="padLeft($(PadRightPadLeftMot),20,'-')" Submit="false" DataType="object" Name="PadLeftMot" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
