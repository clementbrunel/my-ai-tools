# Fonction getDayOfYear()

**Description **: Retourne un numérique contenant le quantième de l’année.

**Forme / Appel **: getDayOfYear(**Date**) retourne un nombre entier
**Paramètre[1] **: **Date**

**Exemple **: getDayOfYear($(date))

```xml
<!-- Variable qui retourne un numérique contenant le quantième de l’année -->
<Variable DataType="integer" Expression="getDayOfYear($(date))" Name="getDayOfYear" Submit="false" />
```

**Description **: Retourne un numérique contenant le quantième de l’année courante.

**Forme / Appel** : getDayOfYear() retourne un nombre entier

**Exemple **: getDayOfYear()

```xml
<!-- Variable qui retourne un numérique contenant le quantième de l’année courante -->
<Variable DataType="integer" Expression="getDayOfYear()" Name="getDayOfYearCurrent" Submit="false" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
