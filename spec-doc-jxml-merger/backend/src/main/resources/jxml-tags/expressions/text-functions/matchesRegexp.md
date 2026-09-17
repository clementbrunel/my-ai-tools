# Fonction matchesRegexp()

**Description **: Cette fonction retourne une valeur booléenne indiquant si la chaîne de caractères correspond à l’expression régulière donnée en paramètre.

**Syntaxe **: matchesRegexp(**String**, **String**) retourne une valeur de type **Boolean**

**Paramètre[1]** : **String** : Chaîne de caractères dans laquelle s’effectue la vérification ("123B")

**Paramètre[2]** : **String **: Expression régulière à tester ("\d+\w*")

**Exemple **: matchesRegexp('123B', '\d+\w*') **Résultat **: true

**Remarque **: Dans cet exemple, l’expression régulière \d+\w* vérifie si la chaîne contient au moins un chiffre suivi éventuellement de lettres. La chaîne "123B" correspond bien à ce motif, donc la fonction retourne true. Cette fonction est particulièrement utile pour valider des formats spécifiques comme des numéros de téléphone, des codes postaux ou des identifiants.

```xml
<?if ((!existsAndNotEmpty($(matchesRegexp_Mot))) || (matchesRegexp($(matchesRegexp_Mot), "^[0-9]+$")))?>
  <!-- Traitement normal : la valeur saisie est valide -->
<?else ?>
  <?setInterviewErrorOnField matchesRegexp_Mot : "Valeur invalide : seuls les chiffres sont autorisés."?>
<?end-if ?>
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
