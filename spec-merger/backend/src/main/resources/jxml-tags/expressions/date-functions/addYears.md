# Fonction addYears()

**Description **: Ajoute ou soustrait un nombre d'années à une date.

**Forme / Appel** : addYears(**Date**, **Integer**) retourne une date
**Paramètre[1**] : **Date**
**Paramètre[2]** : **Integer **: Nombre d’années à ajouter (valeur positive) ou à retrancher (valeur négative)

**Exemple **: addYears($(date), 10)

```xml
<!--Date du jour plus (+) 10 ans -->
<Variable Expression="addYears(getDate(), 10)" Submit="false" DataType="date" Name="addYears" />
```

**Exemple **: addYears($(date), -5)

```xml
<!--Date du jour moins (-) 5 ans -->
<Variable Expression="addYears(getDate(), -5)" Submit="false" DataType="date" Name="addYears" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
