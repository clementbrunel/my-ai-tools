# Fonction modulo()

**Description** : Cette fonction retourne une valeur numérique correspondant au **reste de la division euclidienne** du dividende par le diviseur. Elle permet donc d’obtenir la partie restante d’une division entre deux nombres entiers.

**Forme / Appel** : modulo(**Integer**, **Integer**) retourne une valeur de type **Integer**
**Paramètre[1]** : **Integer** : Dividende
**Paramètre[2]**: **Integer** : Diviseur

**Exemple **: modulo(10, 3) 
**Résultat **: 1

```xml
<Variable Expression=" modulo($(ModuloDividende),$(ModuloDiviseur))" Submit="false" DataType="integer" Name="ModuloResultat" />
```

Source : documentation JWAY Campus, page "Math Functions" (https://campus.jway.eu/portal/documentation/step/2852).
