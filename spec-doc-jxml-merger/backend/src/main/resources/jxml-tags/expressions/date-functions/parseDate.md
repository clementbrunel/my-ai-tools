# Fonction parseDate()

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

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
