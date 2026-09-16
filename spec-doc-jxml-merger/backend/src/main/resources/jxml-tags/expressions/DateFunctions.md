# Date Functions

Ces fonctions permettent de **manipuler, convertir, stocker, afficher et effectuer des opérations** (comparaisons, calculs, formatage) sur des informations temporelles. Elles facilitent la gestion des dates et heures dans les expressions et conditions.

## Liste des fonctions disponibles

- **getDate()** : Retourne la date courante
- **parseDate(string, dateFormat)** : Analyse une chaîne et retourne une date
- **formatDate(date, dateFormat)** : Formate une date selon un modèle
- **addDays(date, integer)** : Ajoute ou retranche un nombre de jours
- **addOpenDays(date, integer, locale)** : Ajoute ou retranche des jours ouvrés
- **addMonths(date, integer)** : Ajoute ou retranche un nombre de mois
- **addYears(date, integer)** : Ajoute ou retranche un nombre d’années
- **dateDiffInDays(date1, date2)** : Calcule la différence en jours entre deux dates
- **compareDate(date1, date2)** : Compare deux dates et retourne un entier
- **getYear(date)** : Retourne l’année d’une date
- **getYear()** : Retourne l’année courante
- **getMonth(date)** : Retourne le mois d’une date
- **getMonth() **: Retourne le mois courant
- **getDay(date)** : Retourne le jour d’une date
- **getDay()** : Retourne le jour courant
- **getDayOfYear(date)** : Retourne le quantième de l’année
- **getDayOfYear()** : Retourne le quantième de l’année courante
- **getDayOfWeek(date)** : Retourne le numéro du jour de la semaine
- **getDayOfWeek()** : Retourne le numéro du jour de la semaine courante
- **getDayOfWeekLabel(date)** : Retourne le nom du jour de la semaine
- **getDayOfWeekLabel()** : Retourne le nom du jour de la semaine courante
- **getWeek(date)** : Retourne le numéro de la semaine de l’année
- **getWeek()** : Retourne le numéro de la semaine courante

## Exemple d’utilisation de la fonction getDate()

**Description **: Retourne la date courante.
**Forme / Appel** : **getDate()** retourne une **date**

```xml
<!--Retourne la date courante -->      
<Variable DataType="date" Expression="getDate()" Name="getDate" Submit="false" />
```

## Exemple d’utilisation de la fonction parseDate()

**Description** : Analyse une valeur de type chaîne de caractères selon le format spécifié et retourne la date obtenue (ou **null **si l’évaluation est impossible).

**Forme / Appel **: parseDate(**String**,** DateFormat**) retourne une **date**
**Paramètre[1**] : **String **
**Paramètre[2] **: **DateFormat**

**Exemple **: parseDate('28/06/2019', 'dd/MM/yyyy')

```xml
<Question>
  <Label IsTooltipOnly="false" TradId="89">ParseDate</Label>
  <DateBox Format="form" Name="ParseDate" RefreshOnExit="false">
    <Description TradId="">La date va de 01/01/2000 jusqu'à la date du jour</Description>
    <Control ErrorType="error" Type="RangeDate">
      <!-- Expression qui fixe la borne inférieure du calendrier au 01/01/1900 -->
      <Parameter Name="min" Value="parseDate('01/01/1900','dd/MM/yyyy')" />
      <Parameter Name="max" Value="getDate()" />
    </Control>
  </DateBox>
</Question>
```

## Exemple d’utilisation de la fonction formatDate()

**Description** : Retourne une chaîne de caractères obtenue en formatant la date selon le format spécifié.

**Forme / Appel** : formatDate(**Date**, **DateFormat**) retourne une chaîne de caractères (**String)**
**Paramètre[1]** : **Date**
**Paramètre[2]** : **DateFormat**

**Exemple **: formatDate(getDate(), 'dd.MM.yyyy')

```xml
<!-- Formate la date du jour en 'dd.MM.yyyy' -->
<Variable Expression="formatDate(getDate(), 'dd.MM.yyyy')" Submit="false" DataType="string" Name="FormatDate" />
```

## Exemple d’utilisation de la fonction addDays()

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

## Exemple d’utilisation de la fonction addOpenDays()

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

## Exemple d’utilisation de la fonction addMonths()

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

## Exemple d’utilisation de la fonction addYears()

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

## Exemple d’utilisation de la fonction dateDiffInDays()

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

## Exemple d’utilisation de la fonction compareDate()

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

## Exemple d’utilisation de la fonction getYear(date)

**Description** : Retourne la valeur numérique correspondant à l’année d’une date.

**Forme / Appel** : getYear(**Date**) retourne un nombre entier
**Paramètre[1]** : **Date**

**Exemple **: getYear($(date))

```xml
<!-- Variable qui retourne l’année de la date -->
<Variable DataType="integer" Expression="getYear($(date))" Name="getYear" Submit="false" />
```

## Exemple d’utilisation de la fonction getYear()

**Description **: Retourne un nombre entier correspondant à l’année **de la date courante (système).**

**Forme / Appel** : getYear() retourne un nombre entier

**Exemple **: getYear()

```xml
<!-- Variable qui renvoie l’année de la date courante -->
<Variable DataType="integer" Expression="getYear()" Name="getYearCurrent" Submit="false" />
```

## Exemple d’utilisation de la fonction getMonth()

**Description **: Retourne un numérique contenant le mois de la date.

**Forme / Appel** : getMonth(**Date**) retourne un nombre entier
**Paramètre[1] **: **Date**

**Exemple** : getMonth($(date))

```xml
<!--Variable qui renvoie un numérique contenant le mois de la date-->
<Variable DataType="integer" Expression="getMonth($(date))" Name="getMonth" Submit="false" />
```

## Exemple d’utilisation de la fonction getMonth(current)

**Description **: Retourne un numérique contenant le mois de la date courante.

**Forme / Appel** : getMonth() retourne un nombre entier

**Exemple** : getMonth()

```xml
<!-- Variable qui retourne le mois de la date courante -->
<Variable DataType="integer" Expression="getMonth()" Name="getMonthCurrent" Submit="false" />
```

## Exemple d’utilisation de la fonction getDay($(date))

**Description **: Retourne un numérique contenant le jour de la date.

**Forme / Appel** : getDay(**Date**) retourne un nombre entier
**Paramètre[1**] : **Date**

**Exemple **: getDay($(date))

```xml
<!--Variable qui renvoie un numérique contenant le jour de la date Date.-->
<Variable DataType="integer" Expression="getDay($(date))" Name="getDay" Submit="false" />
```

## Exemple d’utilisation de la fonction getDay()

**Description **: Retourne un numérique contenant le jour de la date courante.

**Forme / Appel** : getDay() retourne un nombre entier

**Exemple **: getDay()

```xml
<!-- Variable qui retourne un numérique contenant le jour de la date courante -->
<Variable DataType="integer" Expression="getDay()" Name="getDayCurrent" Submit="false" />
```

## Exemple d’utilisation de la fonction getDayOfYear($(date))

**Description **: Retourne un numérique contenant le quantième de l’année.

**Forme / Appel **: getDayOfYear(**Date**) retourne un nombre entier
**Paramètre[1] **: **Date**

**Exemple **: getDayOfYear($(date))

```xml
<!-- Variable qui retourne un numérique contenant le quantième de l’année -->
<Variable DataType="integer" Expression="getDayOfYear($(date))" Name="getDayOfYear" Submit="false" />
```

## Exemple d’utilisation de la fonction getDayOfYear()

**Description **: Retourne un numérique contenant le quantième de l’année courante.

**Forme / Appel** : getDayOfYear() retourne un nombre entier

**Exemple **: getDayOfYear()

```xml
<!-- Variable qui retourne un numérique contenant le quantième de l’année courante -->
<Variable DataType="integer" Expression="getDayOfYear()" Name="getDayOfYearCurrent" Submit="false" />
```

## Exemple d’utilisation de la fonction getDayOfWeek($(date))

**Description** : Retourne le numéro du jour de la semaine.

**Forme / Appel **: getDayOfWeek(**Date**) retourne un nombre entier
**Paramètre[1]** : **Date**

**Exemple **: getDayOfWeek($(date))

```xml
<!-- Variable qui retourne le numéro du jour de la semaine -->
<Variable DataType="integer" Expression="getDayOfWeek($(date))" Name="getDayOfWeek" Submit="false" />
```

## Exemple d’utilisation de la fonction getDayOfWeek()

**Description **: Retourne le numéro du jour de la semaine courante.

**Forme / Appel** : getDayOfWeek() retourne un nombre entier

**Exemple** : getDayOfWeek()

```xml
<!-- Variable qui retourne le numéro du jour de la semaine courante -->
<Variable DataType="integer" Expression="getDayOfWeek()" Name="getDayOfWeekCurrent" Submit="false" />
```

## Exemple d’utilisation de la fonction getDayOfWeekLabel(Date)

**Description **: Retourne le libellé du jour de la semaine.

**Forme / Appel** : getDayOfWeekLabel(**Date**) retourne une chaîne de caractères (**String**)
**Paramètre[1]** : **Date**

**Exemple **: getDayOfWeekLabel($(date))

```xml
<Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">
  <!-- GetDayOfWeekLabel avec paramètre -->
  <!-- Donnée qui affiche le libellé du jour de la semaine passée en paramètre -->
  <Data Expression="getDayOfWeekLabel($(date))" DataType="string" />
</Paragraph>
```

## Exemple d’utilisation de la fonction getDayOfWeekLabel()

**Description** : Retourne le libellé du jour de la semaine courante.

**Forme / Appel** : getDayOfWeekLabel() retourne une chaîne de caractères (**String**)

**Exemple **: getDayOfWeekLabel()

```xml
<Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">
  <!-- GetDayOfWeekLabel (current) -->
  <!-- Donnée qui affiche le libellé du jour de la semaine courante -->
  <Data Expression="getDayOfWeekLabel()" DataType="string" />
</Paragraph>
```

## Exemple d’utilisation de la fonction getWeek($(date))

**Description **: Retourne le numéro de la semaine dans l’année.

**Forme / Appel** : getWeek(**Date**) retourne un nombre entier
**Paramètre[1]** : **Date**

**Exemple **: getWeek($(date))

```xml
<!-- Variable qui retourne le numéro de la semaine dans l’année -->
<Variable DataType="integer" Expression="getWeek($(date))" Name="getWeek" Submit="false" />
```

## Exemple d’utilisation de la fonction getWeek()

**Description** : Retourne le numéro de la semaine dans l’année courante.

**Forme / Appel** : getWeek() retourne un nombre entier

**Exemple **: getWeek()

```xml
<!-- Variable qui retourne le numéro de la semaine dans l’année courante -->
<Variable DataType="integer" Expression="getWeek()" Name="getWeekCurrent" Submit="false" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
