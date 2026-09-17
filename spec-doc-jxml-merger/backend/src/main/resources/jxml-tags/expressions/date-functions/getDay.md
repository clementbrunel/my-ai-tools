# Fonction getDay()

**Description **: Retourne un numérique contenant le jour de la date.

**Forme / Appel** : getDay(**Date**) retourne un nombre entier
**Paramètre[1**] : **Date**

**Exemple **: getDay($(date))

```xml
<!--Variable qui renvoie un numérique contenant le jour de la date Date.-->
<Variable DataType="integer" Expression="getDay($(date))" Name="getDay" Submit="false" />
```

**Description **: Retourne un numérique contenant le jour de la date courante.

**Forme / Appel** : getDay() retourne un nombre entier

**Exemple **: getDay()

```xml
<!-- Variable qui retourne un numérique contenant le jour de la date courante -->
<Variable DataType="integer" Expression="getDay()" Name="getDayCurrent" Submit="false" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
