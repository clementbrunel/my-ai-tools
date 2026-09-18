# Fonction getWeek()

**Description **: Retourne le numéro de la semaine dans l’année.

**Forme / Appel** : getWeek(**Date**) retourne un nombre entier
**Paramètre[1]** : **Date**

**Exemple **: getWeek($(date))

```xml
<!-- Variable qui retourne le numéro de la semaine dans l’année -->
<Variable DataType="integer" Expression="getWeek($(date))" Name="getWeek" Submit="false" />
```

**Description** : Retourne le numéro de la semaine dans l’année courante.

**Forme / Appel** : getWeek() retourne un nombre entier

**Exemple **: getWeek()

```xml
<!-- Variable qui retourne le numéro de la semaine dans l’année courante -->
<Variable DataType="integer" Expression="getWeek()" Name="getWeekCurrent" Submit="false" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
