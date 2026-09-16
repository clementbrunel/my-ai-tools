# Text Functions

Fonctions permettant de manipuler des textes ou des chaînes de caractères (**String**).

## Fonction contains()

**Description **: Cette fonction retourne une valeur booléenne (true ou false) indiquant si la chaîne de caractères contient la chaîne recherchée.

**Syntaxe **: contains(**String**, **String**) retourne une valeur de type **Boolean**

**Paramètre[1] **: **String **: Chaîne de caractères dans laquelle s’effectue la recherche (who)

**Paramètre[2] **: **String **: Chaîne de caractères recherchée (Mister)

**Exemple** : who = 'Mister J' ; contains($(who), 'Mister') **Résultat **: true

```xml
<QuestionSet HorizontalAlignment="left" 
             LabelHorizontalAlignment="left" 
             LabelPosition="auto" 
             OutputMode="all" 
             OutputTarget="all" 
             Spacing="normal">

  <Title>contains</Title>

  <Question>
    <Label IsTooltipOnly="false" TradId="117">Standard / List</Label>
    <ListBox DataType="string" 
             MultiValues="checkbox" 
             Name="StandardList" 
             NumberOfVisibleRows="5" 
             OptionsPerLine="2" 
             RefreshOnExit="true">
      <Description>
        Cette fonction retourne une valeur booléenne indiquant si la chaîne de caractères contient la chaîne recherchée.
      </Description>
      <Option TradId="118" Value="Box1">Box1</Option>
      <Option TradId="119" Value="Box2">Box2</Option>
      <Option TradId="120" Value="Box3">Box3</Option>
      <Option TradId="121" Value="Box4">Box4</Option>
      <Option TradId="122" Value="AutreOption">Autre option</Option>
    </ListBox>
  </Question>

  <!-- La question est visible si la liste contient le choix Box1, Box2 ou Box3 -->
  <Question IsVisible="(contains($(StandardList),'Box1') || contains($(StandardList),'Box2') || contains($(StandardList),'Box3'))">
    <Label IsTooltipOnly="false" TradId="123">Précisez le nombre de Box</Label>
    <TextBox AutoSize="false" 
             DataType="string" 
             Name="StandardListAutre" 
             NumberOfVisibleCharacters="15" 
             RefreshOnExit="true" />
  </Question>

</QuestionSet>
```

## Fonction startsWith()

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

## Fonction endsWith()

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

## Fonction replace()

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

## Fonction trim()

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

## Fonction toUpperCase()

**Description **: Cette fonction retourne une chaîne de caractères correspondant à la chaîne d’origine, convertie en majuscules.

**Syntaxe **: toUpperCase(**String**) retourne une valeur de type **String**

**Paramètre[1] **: **String **: Chaîne à modifier 'Hello World.'

**Exemple** : toUpperCase('Hello World.') Résultat : 'HELLO WORLD'

**Remarque **: Dans cet exemple, la fonction convertit toutes les lettres de la chaîne "Hello World." en majuscules. Les caractères non alphabétiques (espaces, points, chiffres, etc.) restent inchangés.

```xml
<Variable Expression=" toUpperCase($(ToUpperCase_Mot))" Submit="false" DataType="object" Name="ToUpperCase_Mot" />
```

## Fonction toLowerCase()

**Description **: Cette fonction retourne une chaîne de caractères correspondant à la chaîne d’origine, convertie en minuscules.

**Syntaxe **: toLowerCase(**String**) retourne une valeur de type String

**Paramètre[1]** : **String **: Chaîne de caractères à modifier ("HELLO WORLD.")

**Exemple **: toLowerCase('HELLO WORLD.') **Résultat **: "hello world"

**Remarque **: Dans cet exemple, la fonction convertit toutes les lettres de la chaîne "HELLO WORLD." en minuscules. Les caractères non alphabétiques (espaces, points, chiffres, etc.) ne sont pas modifiés.

```xml
<Variable Expression="toLowerCase($(ToLowerCase_Mot))" Submit="false" DataType="object" Name="ToLowerCase_Mot" />
```

## Fonction subString()

**Description **: Cette fonction retourne une chaîne de caractères correspondant à la chaîne d’origine, à partir de la position spécifiée dans le texte.

**Syntaxe **: subString(**String**, **Integer**) retourne une valeur de type **String**

**Paramètre[1**] : **String **: Chaîne de caractères à modifier ("Hello World.")

**Paramètre[2]** : **Integer **: Position de départ du découpage (le premier caractère correspond à la position 0)

**Exemple** : subString('Hello World.', 3) **Résultat **: "lo World."

**Remarque : **Dans cet exemple, la fonction renvoie la partie de la chaîne "Hello World." à partir du 4ᵉ caractère (puisque la position 0 correspond à la première lettre). Le résultat obtenu est donc "lo World.".

```xml
<Variable Expression="subString($(SubStringMot),1)" Submit="false" DataType="string" Name="SubStringMotObtenue1" />
```

## Fonction subString()

**Description **: Cette fonction retourne une chaîne de caractères correspondant à une portion de la chaîne d’origine, comprise entre les positions de début et de fin spécifiées.

**Syntaxe **: subString(**String**, **Integer**, **Integer **) retourne une valeur de type **String**

**Paramètre[1] **: **String **: Chaîne de caractères à modifier ("Hello World.")

**Paramètre[2] **: **Integer **: Position de départ (le premier caractère correspond à la position 0)

**Paramètre[3] **: **Integer **: Position de fin (le caractère à cette position n’est pas inclus dans le résultat)

**Exemple **: subString('Hello World.' , 3 , 5) **Résultat **: "lo"

**Remarque **: Dans cet exemple, la fonction renvoie les caractères situés entre les positions 3 et 5 de la chaîne "Hello World.". Le caractère à la position 5 n’est pas inclus, donc le résultat est "lo".

```xml
<Variable Expression="subString($(SubStringMot),1,7)" Submit="false" DataType="object" Name="SubStringMotObtenue2" />
```

## Fonction padRight()

**Description **: Cette fonction retourne une chaîne de caractères complétée à droite par le caractère de remplissage indiqué, jusqu’à atteindre la longueur spécifiée. Si la chaîne d’origine est plus longue que la longueur demandée, elle est tronquée.

**Syntaxe** : padRight(**String**, **Integer**, **Char**) retourne une valeur de type **String**

**Paramètre[1]** : **String **: Chaîne de caractères à modifier ("Hello World.")

**Paramètre[2]** : **Integer **: Longueur finale souhaitée

**Paramètre[3]** : **Char **: Caractère de remplissage ('0')

**Exemple **: padRight('Hello World.' , 15 , '0') **Résultat **: "Hello World.000"

**Remarque **: Dans cet exemple, la chaîne "Hello World." est complétée avec le caractère "0" jusqu’à atteindre une longueur totale de 15 caractères. Si la chaîne avait été plus longue que 15, elle aurait été raccourcie pour correspondre à cette longueur.

```xml
<Variable Expression="padRight($(PadRightPadLeftMot),20,'-')" Submit="false" DataType="string" Name="PadRightMot" />
```

## Fonction padLeft()

**Description **: Cette fonction retourne une chaîne de caractères complétée à gauche par le caractère de remplissage indiqué, jusqu’à atteindre la longueur spécifiée. Si la chaîne d’origine est plus longue que la longueur demandée, elle est tronquée.

**Syntaxe **: padLeft( **String**, **Integer**, **Char **) retourne une valeur de type **String**

**Paramètre[1]** : **String **: Chaîne de caractères à modifier ("Hello World.")

**Paramètre[2] **: **Integer **: Longueur finale souhaitée

**Paramètre[3]** : **Char **: Caractère de remplissage ('0')

**Exemple **: padLeft('Hello World.' , 15 , '0') **Résultat **: "000Hello World."

**Remarque **: Dans cet exemple, la chaîne "Hello World." est complétée avec le caractère "0" jusqu’à atteindre une longueur totale de 15 caractères. Si la chaîne avait été plus longue que 15, elle aurait été raccourcie pour correspondre à cette longueur.

```xml
<Variable Expression="padLeft($(PadRightPadLeftMot),20,'-')" Submit="false" DataType="object" Name="PadLeftMot" />
```

## Fonction replaceRegexp()

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

## Fonction matchesRegexp()

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

## Fonction getTokens()

**Description **: Cette fonction retourne une liste de chaînes de caractères extraite de la chaîne d’origine, en utilisant le délimiteur passé en paramètre pour séparer les éléments.

**Syntaxe **: getTokens(**String**, **String**) retourne une valeur de type** String[ ]**

**Paramètre[1] **: **String **: Chaîne de caractères à découper ("bonjour,hello,hi")

**Paramètre[2]** : **String** : Caractère ou chaîne servant de délimiteur (",")

**Exemple **: tokens = getTokens('bonjour,hello,hi', ',') **Résultat :** ["bonjour", "hello", "hi"]

**Remarque **: Dans cet exemple, la fonction découpe la chaîne "bonjour,hello,hi" à chaque virgule et renvoie une liste de trois éléments : "bonjour", "hello" et "hi". Elle permet de transformer facilement une chaîne délimitée en une liste exploitable dans une boucle foreach.

```xml
<Variable Expression="  getTokens('bonjour,hello,hi', ',')" Submit="false" DataType="string" Name="GetTokens_Resultat" />
```

## Fonction extractsDigits()

**Description **: Cette fonction retourne une chaîne de caractères ne contenant que les chiffres extraits de la chaîne d’origine.

**Syntaxe **: extractsDigits(**String**) retourne une valeur de type **String**

**Paramètre[1] **: **String **: Chaîne de caractères dans laquelle la recherche sera effectuée ("Tel : + 352 54-22-23")

**Exemple **: extractsDigits('Tel : + 352 54-22-23') **Résultat **: "352542223"

**Remarque **: Dans cet exemple, la fonction parcourt la chaîne "Tel : + 352 54-22-23" et extrait uniquement les caractères numériques. Le résultat retourné est donc "352542223". Cette fonction est particulièrement utile pour nettoyer des numéros de téléphone, des identifiants ou des chaînes contenant des chiffres dispersés parmi d’autres caractères.

```xml
<Variable Expression=" extractsDigits($(ExtractsDigits_Entree))" Submit="false" DataType="string" Name="Extracts_DigitsResultat" />
```

## Fonction formatString()

**Description **: Cette fonction retourne une chaîne de caractères représentant la valeur numérique passée en paramètre, mise en forme selon le format spécifié.

**Syntaxe **: formatString(**Value**,** StringFormat**) retourne une valeur de type **String**

**Paramètre[1]** : **Value **: Valeur numérique à formater ("352542223")

**Paramètre[2] **: **StringFormat** : Modèle de format à appliquer ("Tel : + ### ##-##-##")

**Exemple **: formatString('352542223', 'Tel : + ### ##-##-##') **Résultat **: "Tel : + 352 54-22-23"

**Remarque **: Dans cet exemple, la fonction prend la valeur "352542223" et l’affiche selon le format défini "Tel : + ### ##-##-##". Chaque symbole # est remplacé par un chiffre de la valeur fournie, dans l’ordre où ils apparaissent. Cette fonction est utile pour présenter des numéros de téléphone, des identifiants ou des valeurs numériques selon un format prédéfini sans modifier la donnée d’origine.

```xml
 <Variable Expression="formatString($(FormatNumberEntree),&quot;+ ### ###-##-##-##&quot;)" Submit="false" DataType="string" Name="FormatStringSorties" />
```

## Fonction getSize()

**Description **: Cette fonction retourne le nombre total de caractères contenus dans une chaîne de caractères.

**Syntaxe **: getSize(**String**) retourne une valeur de type **Integer**

**Paramètre[1] **: **String **: Chaîne de caractères dont on souhaite connaître la longueur ("Hello World")

**Exemple **: getSize('Hello World') **Résultat **: 11

**Remarque **: Dans cet exemple, la chaîne "Hello World" contient 11 caractères, y compris l’espace entre les deux mots. Cette fonction est utile pour valider la longueur d’un champ de saisie, limiter le nombre de caractères autorisés ou effectuer des comparaisons de tailles dans des expressions conditionnelles.

```xml
 <Variable Expression=" getSize($(GetSizeMot))" Submit="false" DataType="integer" Name="GetSizeNombreMot" />
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
