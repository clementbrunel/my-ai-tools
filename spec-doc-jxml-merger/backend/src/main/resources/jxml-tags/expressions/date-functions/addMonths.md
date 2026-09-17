# Fonction addMonths()

**Description** : Ajoute ou soustrait un nombre de mois à une date.

**Forme / Appel** : addMonths(**Date**, **Integer**) retourne une date
**Paramètre[1]** : **Date**
**Paramètre[2]** : **Integer **: Nombre de mois à ajouter (valeur positive) ou à retrancher (valeur négative)

**Exemple **: addMonths($(date), 10)

```xml
<!--Date du jour plus (+) 10 mois -->
<Variable Expression="addMonths(getDate(), 10)" Submit="false" DataType="date" Name="AddMonthsPlus" />
```

**Exemple **: addMonths($(date), -4 )

```xml
<!--Date du jour moins (-) 4 mois -->
<Variable Expression="addMonths(getDate(), -4)" Submit="false" DataType="date" Name="AddMonthsMinus" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
