# Fonction getSize()

**Description **: Cette fonction retourne le nombre total de caractères contenus dans une chaîne de caractères.

**Syntaxe **: getSize(**String**) retourne une valeur de type **Integer**

**Paramètre[1] **: **String **: Chaîne de caractères dont on souhaite connaître la longueur ("Hello World")

**Exemple **: getSize('Hello World') **Résultat **: 11

**Remarque **: Dans cet exemple, la chaîne "Hello World" contient 11 caractères, y compris l’espace entre les deux mots. Cette fonction est utile pour valider la longueur d’un champ de saisie, limiter le nombre de caractères autorisés ou effectuer des comparaisons de tailles dans des expressions conditionnelles.

```xml
 <Variable Expression=" getSize($(GetSizeMot))" Submit="false" DataType="integer" Name="GetSizeNombreMot" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
