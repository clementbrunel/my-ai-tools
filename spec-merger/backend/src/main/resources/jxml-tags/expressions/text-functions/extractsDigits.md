# Fonction extractsDigits()

**Description **: Cette fonction retourne une chaîne de caractères ne contenant que les chiffres extraits de la chaîne d’origine.

**Syntaxe **: extractsDigits(**String**) retourne une valeur de type **String**

**Paramètre[1] **: **String **: Chaîne de caractères dans laquelle la recherche sera effectuée ("Tel : + 352 54-22-23")

**Exemple **: extractsDigits('Tel : + 352 54-22-23') **Résultat **: "352542223"

**Remarque **: Dans cet exemple, la fonction parcourt la chaîne "Tel : + 352 54-22-23" et extrait uniquement les caractères numériques. Le résultat retourné est donc "352542223". Cette fonction est particulièrement utile pour nettoyer des numéros de téléphone, des identifiants ou des chaînes contenant des chiffres dispersés parmi d’autres caractères.

```xml
<Variable Expression=" extractsDigits($(ExtractsDigits_Entree))" Submit="false" DataType="string" Name="Extracts_DigitsResultat" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
