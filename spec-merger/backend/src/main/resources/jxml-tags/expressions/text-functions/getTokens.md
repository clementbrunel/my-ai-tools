# Fonction getTokens()

**Description **: Cette fonction retourne une liste de chaînes de caractères extraite de la chaîne d’origine, en utilisant le délimiteur passé en paramètre pour séparer les éléments.

**Syntaxe **: getTokens(**String**, **String**) retourne une valeur de type** String[ ]**

**Paramètre[1] **: **String **: Chaîne de caractères à découper ("bonjour,hello,hi")

**Paramètre[2]** : **String** : Caractère ou chaîne servant de délimiteur (",")

**Exemple **: tokens = getTokens('bonjour,hello,hi', ',') **Résultat :** ["bonjour", "hello", "hi"]

**Remarque **: Dans cet exemple, la fonction découpe la chaîne "bonjour,hello,hi" à chaque virgule et renvoie une liste de trois éléments : "bonjour", "hello" et "hi". Elle permet de transformer facilement une chaîne délimitée en une liste exploitable dans une boucle foreach.

```xml
<Variable Expression="  getTokens('bonjour,hello,hi', ',')" Submit="false" DataType="string" Name="GetTokens_Resultat" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
