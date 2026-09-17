# Fonction startsWith()

**Description **: Cette fonction retourne une valeur booléenne indiquant si la chaîne de caractères commence par la chaîne recherchée.

**Syntaxe **: startsWith(**String**, **String**) retourne une valeur de type **Boolean**

**Paramètre[1]** : **String **: Chaîne de caractères dans laquelle s'effectue la recherche.(who)

**Paramètre[2]** : **String **: Chaîne de caractères recherchée. (Mister)

**Exemple **: who='Mister J'; startsWith($(who), 'Mister') **Résultat **: "true"

Instruction qui vérifie si l'entrée du champ de saisie commence par "**Ta**".

```xml
 <?if ((!existsAndNotEmpty($(startsWith_Mot))) || (startsWith($(startsWith_Mot), 'Ta')))?>
      <?else ?>
      <?setInterviewErrorOnField startsWith_Mot : "Mot invalide il doit commencer par Ta"?>
 <?end-if ?>
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
