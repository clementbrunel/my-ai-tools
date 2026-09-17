# Fonction addDays()

**Description **: Ajoute ou soustrait un nombre de jours à une **date.**

**Forme / Appel **: addDays(**Date**, **Integer**) retourne une **date**
**Paramètre[1]** : **Date**
**Paramètre[2]** : **Integer **: Nombre de jours à ajouter (valeur positive) ou à retrancher (valeur négative)

**Exemple **: addDays($(date), 10)

```xml
<!--Ajoute 10 jours sur la date du jour -->
<Variable Expression="addDays(getDate(), 10)" Submit="false" DataType="date" Name="AddDaysPlus" />
```

**Exemple **: addDays($(date), '-2')

```xml
<!-- Retranche 2 jours à la date du jour -->
<Variable Expression="addDays(getDate(), -2)" Submit="false" DataType="date" Name="AddDaysMinus" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
