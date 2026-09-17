# Fonction dateDiffInDays()

**Description** : Retourne un nombre entier représentant la différence de jours entre deux dates. Le résultat est négatif si la première date est postérieure à la seconde (date1 > date2).
⚠️ Le résultat correspond au nombre exact de jours séparant les deux dates, c’est-à-dire le nombre de tranches de 24 h.

**Forme / Appel** : dateDiffInDays(**Date**, **Date**) retourne un nombre entier
**Paramètre[1**] : **Date1**
**Paramètre[2]** : **Date2**

**Exemple **: dateDiffInDays($(date1), $(date2))

```xml
<!-- Variable qui retourne la différence de jours entre deux dates -->
<Variable DataType="integer" Expression=" dateDiffInDays($(date1),$(date2))" Name="dateDiffInDays" Submit="false" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
