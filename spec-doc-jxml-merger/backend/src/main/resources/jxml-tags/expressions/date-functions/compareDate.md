# Fonction compareDate()

**Description** : Cette fonction compare deux dates et retourne un nombre entier :

- négatif si date1 < date2
- positif si date1 > date2
- 0 si les deux dates sont identiques

**Forme / Appel** : compareDate(**Date**, **Date**) retourne un nombre entier
**Paramètre[1]** : **Date**
**Paramètre[2]** : **Date**

**Exemple **: compareDate($(date1), $(date2))

```xml
 <!--Variable qui renvoie la valeur de la comparaison des date1 et date2 -->
 <Variable Expression="($(date1)) &lt;= ($(date2))" Submit="false" DataType="object" Name="compareDate" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
