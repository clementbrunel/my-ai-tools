# Fonction padRight()

**Description **: Cette fonction retourne une chaîne de caractères complétée à droite par le caractère de remplissage indiqué, jusqu’à atteindre la longueur spécifiée. Si la chaîne d’origine est plus longue que la longueur demandée, elle est tronquée.

**Syntaxe** : padRight(**String**, **Integer**, **Char**) retourne une valeur de type **String**

**Paramètre[1]** : **String **: Chaîne de caractères à modifier ("Hello World.")

**Paramètre[2]** : **Integer **: Longueur finale souhaitée

**Paramètre[3]** : **Char **: Caractère de remplissage ('0')

**Exemple **: padRight('Hello World.' , 15 , '0') **Résultat **: "Hello World.000"

**Remarque **: Dans cet exemple, la chaîne "Hello World." est complétée avec le caractère "0" jusqu’à atteindre une longueur totale de 15 caractères. Si la chaîne avait été plus longue que 15, elle aurait été raccourcie pour correspondre à cette longueur.

```xml
<Variable Expression="padRight($(PadRightPadLeftMot),20,'-')" Submit="false" DataType="string" Name="PadRightMot" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
