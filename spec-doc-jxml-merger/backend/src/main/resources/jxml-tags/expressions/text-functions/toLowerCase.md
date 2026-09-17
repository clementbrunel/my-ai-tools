# Fonction toLowerCase()

**Description **: Cette fonction retourne une chaîne de caractères correspondant à la chaîne d’origine, convertie en minuscules.

**Syntaxe **: toLowerCase(**String**) retourne une valeur de type String

**Paramètre[1]** : **String **: Chaîne de caractères à modifier ("HELLO WORLD.")

**Exemple **: toLowerCase('HELLO WORLD.') **Résultat **: "hello world"

**Remarque **: Dans cet exemple, la fonction convertit toutes les lettres de la chaîne "HELLO WORLD." en minuscules. Les caractères non alphabétiques (espaces, points, chiffres, etc.) ne sont pas modifiés.

```xml
<Variable Expression="toLowerCase($(ToLowerCase_Mot))" Submit="false" DataType="object" Name="ToLowerCase_Mot" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
