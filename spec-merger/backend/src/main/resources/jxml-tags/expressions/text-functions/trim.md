# Fonction trim()

**Description **: Cette fonction retourne une chaîne de caractères correspondant à la chaîne d’origine, nettoyée des espaces situés au début et à la fin.

**Syntaxe **: trim(**String**) retourne une valeur de type **String**

**Paramètre[1] **: **String **: Chaîne de caractères à modifier " Hello World. "

**Exemple **: trim(' Hello World. ') **Résultat** : 'Hello World.'

**Remarque : **Dans cet exemple, la fonction supprime les espaces placés avant et après le texte **"**Hello World**."**, mais ne modifie pas les espaces situés à l’intérieur de la chaîne.

```xml
<?set $(trim_Mot) = trim($(trim_Mot))?>
<?if (existsAndNotEmpty($(trim_Mot)))?>
  <!-- Traitement normal : le mot est valide -->
<?else ?>
  <?setInterviewErrorOnField trim_Mot : "Le champ ne peut pas être vide ou uniquement composé d’espaces."?>
<?end-if ?>
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
