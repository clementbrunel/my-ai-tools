# Fonction getYear()

**Description** : Retourne la valeur numérique correspondant à l’année d’une date.

**Forme / Appel** : getYear(**Date**) retourne un nombre entier
**Paramètre[1]** : **Date**

**Exemple **: getYear($(date))

```xml
<!-- Variable qui retourne l’année de la date -->
<Variable DataType="integer" Expression="getYear($(date))" Name="getYear" Submit="false" />
```

**Description **: Retourne un nombre entier correspondant à l’année **de la date courante (système).**

**Forme / Appel** : getYear() retourne un nombre entier

**Exemple **: getYear()

```xml
<!-- Variable qui renvoie l’année de la date courante -->
<Variable DataType="integer" Expression="getYear()" Name="getYearCurrent" Submit="false" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
