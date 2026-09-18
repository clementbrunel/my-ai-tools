# Fonction formatString()

**Description **: Cette fonction retourne une chaîne de caractères représentant la valeur numérique passée en paramètre, mise en forme selon le format spécifié.

**Syntaxe **: formatString(**Value**,** StringFormat**) retourne une valeur de type **String**

**Paramètre[1]** : **Value **: Valeur numérique à formater ("352542223")

**Paramètre[2] **: **StringFormat** : Modèle de format à appliquer ("Tel : + ### ##-##-##")

**Exemple **: formatString('352542223', 'Tel : + ### ##-##-##') **Résultat **: "Tel : + 352 54-22-23"

**Remarque **: Dans cet exemple, la fonction prend la valeur "352542223" et l’affiche selon le format défini "Tel : + ### ##-##-##". Chaque symbole # est remplacé par un chiffre de la valeur fournie, dans l’ordre où ils apparaissent. Cette fonction est utile pour présenter des numéros de téléphone, des identifiants ou des valeurs numériques selon un format prédéfini sans modifier la donnée d’origine.

```xml
 <Variable Expression="formatString($(FormatNumberEntree),&quot;+ ### ###-##-##-##&quot;)" Submit="false" DataType="string" Name="FormatStringSorties" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
