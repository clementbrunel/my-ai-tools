# Fonction getDayOfWeek()

**Description** : Retourne le numéro du jour de la semaine.

**Forme / Appel **: getDayOfWeek(**Date**) retourne un nombre entier
**Paramètre[1]** : **Date**

**Exemple **: getDayOfWeek($(date))

```xml
<!-- Variable qui retourne le numéro du jour de la semaine -->
<Variable DataType="integer" Expression="getDayOfWeek($(date))" Name="getDayOfWeek" Submit="false" />
```

**Description **: Retourne le numéro du jour de la semaine courante.

**Forme / Appel** : getDayOfWeek() retourne un nombre entier

**Exemple** : getDayOfWeek()

```xml
<!-- Variable qui retourne le numéro du jour de la semaine courante -->
<Variable DataType="integer" Expression="getDayOfWeek()" Name="getDayOfWeekCurrent" Submit="false" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
