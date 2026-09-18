# Fonction getMonth()

**Description **: Retourne un numérique contenant le mois de la date.

**Forme / Appel** : getMonth(**Date**) retourne un nombre entier
**Paramètre[1] **: **Date**

**Exemple** : getMonth($(date))

```xml
<!--Variable qui renvoie un numérique contenant le mois de la date-->
<Variable DataType="integer" Expression="getMonth($(date))" Name="getMonth" Submit="false" />
```

**Description **: Retourne un numérique contenant le mois de la date courante.

**Forme / Appel** : getMonth() retourne un nombre entier

**Exemple** : getMonth()

```xml
<!-- Variable qui retourne le mois de la date courante -->
<Variable DataType="integer" Expression="getMonth()" Name="getMonthCurrent" Submit="false" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
