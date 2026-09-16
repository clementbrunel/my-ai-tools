# Arithmetic Operators

Symboles spéciaux utilisés pour effectuer des opérations mathématiques de base (Calcul des valeurs numériques et manipulation des chaînes de caractères). Il s'agit des opérateurs suivant: "**+**", "**-**" , "*****" ,"**/**" utilisés respectivement pour l'addition, la soustraction, la multiplication, la division des valeurs numériques. L'addition permet aussi la concaténation pour une chaîne de caractères.

**Les opérateurs arithmétiques** sont des symboles spéciaux utilisés pour effectuer des opérations mathématiques de base (calculs numériques) **et certaines manipulations de chaînes**. Les opérateurs disponibles sont : **+**, **-**, *****, **/**.

- **+ **: Addition numérique et concaténation de chaînes
- **-** : Soustraction
- ***** : Multiplication
- **/** : Division

## Exemple : Additionner deux valeurs numériques

Si **a = 5 **et **b = 3**, alors la variable contiendra **8**, car l’opérateur + fait une addition classique entre deux nombres.

```xml
<!-- Variable qui additionne les valeurs numériques de a et b et retourne la valeur de c -->
<Variable DataType="object" Expression="$(a)+$(b)" Name="c" Submit="false" />
```

## Exemple : Concaténation avec un espace

Si **a = "hello"**, alors l’expression **$(a)+' '+1** retournera **"hello 1"**, car l’opérateur **+** concatène la chaîne contenue dans **a**, ajoute un espace (**' '**) et colle ensuite la valeur **1**.

```xml
<!-- Variable qui concatène la chaîne contenue dans a, un espace, et la valeur 1 -->
<Variable DataType="object" Expression="$(a)+' '+1" Name="concat" Submit="false" />
```

## Exemple : Soustraire deux valeurs numériques

Si **a = 5** et** b = 3**, alors l’expression **$(a) - $(b)** retournera **2**, car l’opérateur **-** fait une soustraction classique entre deux nombres.

```xml
<!--Variable qui soustrait les valeurs de a et b et retourne la valeur de c -->
<Variable DataType="object" Expression="$(a)-$(b)" Name="c" Submit="false" />
```

## Exemple : Multiplier deux valeurs numériques

Si **a = 3** et **b = 5**, alors l’expression **$(a) * $(b)** retournera **15**, car l’opérateur ***** effectue une multiplication classique entre deux nombres.

```xml
<!--Variable qui multiplie les valeurs de a et de b et retourne la valeur de c -->
<Variable DataType="object" Expression="$(a)*$(b)" Name="c" Submit="false" />
```

## Exemple : Diviser deux valeurs numériques

Si** a = 10** et** b = 2**, alors l’expression **$(a) / $(b)** retournera **5**, car l’opérateur **/** divise la valeur de **a** par la valeur de **b**.

```xml
<!-- Variable qui calcule le quotient de la division des valeurs de a et b et retourne la valeur de c -->
<Variable DataType="object" Expression="$(a)/$(b)" Name="c" Submit="false" />
```

Source : documentation JWAY Campus, page "Arithmetic Operators" (https://campus.jway.eu/portal/documentation/step/2843).
