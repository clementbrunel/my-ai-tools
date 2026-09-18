# Fonction addOpenDays()

**Description** : Ajoute ou soustrait un nombre de jours ouvrés à une **date.**

**Forme / Appel** : addOpenDays(**Date**, **Integer**) retourne une **date**
**Paramètre[1]** : **Date**
**Paramètre[2]** : **Integer **: Nombre de jours ouvrés à ajouter (valeur positive) ou à retrancher (valeur négative)

**Exemple **: addOpenDays($(date), 10, 'FrFr')

```xml
<!--Date du jour plus (+) 10 jours ouvrés  -->
<Variable Expression="addOpenDays(getDate(), 10,'FrFr')" Submit="false" DataType="date" Name="addOpenDaysPlus" />
```

**Exemple **: addOpenDays($(date), -3, 'FrFr')

```xml
<!-- Date du jour moins (-) 3 jours ouvrés -->
<Variable Expression="addOpenDays(getDate(), -3, 'FrFr')" Submit="false" DataType="date" Name="addOpenDaysMinus" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
