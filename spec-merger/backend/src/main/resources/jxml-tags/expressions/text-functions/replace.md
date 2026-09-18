# Fonction replace()

**Description** : Cette fonction retourne une chaîne de caractères correspondant à la chaîne d’origine dont toutes les occurrences de la chaîne recherchée ont été remplacées par la chaîne de substitution.

**Syntaxe **: replace(**String**, **String**, **String**) retourne une valeur de type **String**

**Paramètre[1] **: **String **: Chaîne de caractères dans laquelle la valeur à remplacer sera recherchée "Hello World."

**Paramètre[2] **: **String **: Chaîne de caractères recherchée 'World'

**Paramètre[3] **:** String **: Chaîne de caractères de remplacement 'Everybody'

**Exemple **: replace('Hello World.', 'World', 'Everybody') Résultat : "Hello Everybody"

**Remarque** : Dans cet exemple, la fonction recherche le mot "World" dans la chaîne "Hello World." et le remplace par "Everybody". Le résultat obtenu est donc **"Hello Everybody."**. Si plusieurs occurrences du mot recherché existent dans la chaîne, elles seront toutes remplacées.

```xml
<Variable Expression="replace($(Replace_chaineInitiale),$(Replace_Mot),$(Replace_Nouveau_Mot))" Submit="false" DataType="object" Name="Replace_ChaineObtenue" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
