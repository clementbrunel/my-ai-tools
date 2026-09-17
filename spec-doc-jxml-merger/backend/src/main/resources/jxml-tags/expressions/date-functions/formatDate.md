# Fonction formatDate()

**Description** : Retourne une chaîne de caractères obtenue en formatant la date selon le format spécifié.

**Forme / Appel** : formatDate(**Date**, **DateFormat**) retourne une chaîne de caractères (**String)**
**Paramètre[1]** : **Date**
**Paramètre[2]** : **DateFormat**

**Exemple **: formatDate(getDate(), 'dd.MM.yyyy')

```xml
<!-- Formate la date du jour en 'dd.MM.yyyy' -->
<Variable Expression="formatDate(getDate(), 'dd.MM.yyyy')" Submit="false" DataType="string" Name="FormatDate" />
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
