# Fonction replaceRegexp()

**Description **: Cette fonction retourne une chaîne de caractères correspondant à la chaîne d’origine dont toutes les occurrences correspondant à l’expression régulière recherchée ont été remplacées par la chaîne de substitution.

**Syntaxe **: replaceRegexp(**String**, **String**, **String**) retourne une valeur de type **String**

**Paramètre[1]** : **String **: Chaîne de caractères dans laquelle la valeur à remplacer sera recherchée ("Hello World.")

**Paramètre[2]** : **String **: Expression régulière utilisée pour identifier la portion de texte à remplacer ("W.+d")

**Paramètre[3]** : **String **: Chaîne de caractères de remplacement ("Everybody")

**Exemple **: replaceRegexp('Hello World.', 'W.+d', 'Everybody') **Résultat **: "Hello Everybody"

**Remarque **: Dans cet exemple, l’expression régulière W.+d correspond à la sous-chaîne "World" dans le texte "Hello World.". La fonction remplace cette portion par "Everybody", donnant ainsi le résultat "Hello Everybody". L’utilisation d’expressions régulières permet d’effectuer des remplacements plus complexes qu’une simple recherche de texte fixe.

```xml
<?set $(replaceRegexp_Mot) = replaceRegexp($(replaceRegexp_Mot), "W.+d", "Everybody")?>
<?if (existsAndNotEmpty($(replaceRegexp_Mot)))?>
  <!-- Traitement normal : le mot a bien été transformé -->
<?else ?>
  <?setInterviewErrorOnField replaceRegexp_Mot : "Erreur : aucune correspondance trouvée pour l’expression régulière."?>
<?end-if ?>
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
