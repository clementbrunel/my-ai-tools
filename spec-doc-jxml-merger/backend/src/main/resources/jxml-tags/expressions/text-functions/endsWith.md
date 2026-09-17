# Fonction endsWith()

**Description **: Cette fonction retourne une valeur booléenne indiquant si la chaîne de caractères se termine par la chaîne recherchée.

**Syntaxe **: endsWith(**String**, **String**) retourne une valeur de type **Boolean**

**Paramètre[1]** : **String **: Chaîne de caractères dans laquelle s'effectue la recherche (who)

**Paramètre[2] **: **String **: Chaîne de caractères recherchée. (r)

**Exemple **: who='Mister J'; endsWith($(who), 'r') **Résultat **: false

**Remarque :** Dans cet exemple, la variable who contient la chaîne "Mister J", et la fonction vérifie si cette chaîne se termine par "**r**".

Instruction qui vérifie si l'entrée du champ de saisie se termine par "**er**".

```xml
<?if ((!existsAndNotEmpty($(endsWith_Mot))) || (endsWith($(endsWith_Mot), "er")))?>
      <?else ?>
      <?setInterviewErrorOnField endsWith_Mot : "Mot invalide il doit se terminer  par er"?>
<?end-if ?>
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
