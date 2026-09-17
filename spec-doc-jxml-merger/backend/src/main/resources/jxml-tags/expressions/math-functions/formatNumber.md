# Fonction formatNumber()

**Description **: Cette fonction retourne une valeur Numérique correspondant à la valeur numérique d'origine avec la précision demandée.

**Forme / Appel** : formatNumber(**Value**, **Integer**) retourne une valeur de type numérique (**Double**)
**Paramètre[1]** : **Value **: Valeur numérique à formatter
**Paramètre[2] **: **Integer **: Nombre de décimales attendues

**Exemple **: formatNumber(3.14159265, 2)
**Résultat** : 3.14

```xml
<Content NewPage="none" OutputMode="all" OutputTarget="all" StyleName="">
  <!--Variables : formate la valeur saisie avec 2 ou 0 décimales-->
  <Variable Expression="formatNumber($(FormatNumberEntree), 2)" Submit="false" DataType="string" Name="FormatNumberResultat"/>
  <Variable Expression="formatNumber($(FormatNumberEntree), 0)" Submit="false" DataType="string" Name="FormatNumberResultat1"/>

  <QuestionSet HorizontalAlignment="left" LabelHorizontalAlignment="left" LabelPosition="auto" OutputMode="all" OutputTarget="all" Spacing="normal">
    <!--<Title>formatNumber</Title>-->
    <Question>
       <!--<Label IsTooltipOnly="false" TradId="117">Entrer un nombre décimal</Label>-->
      <NumberBox RefreshOnExit="true" Name="FormatNumberEntree" FractionDigits="7" NumberOfVisibleCharacters="15" AutoSize="false">
        <!--<Description>(minimum 3 chiffres après la virgule)</Description>-->
      </NumberBox>
    </Question>
    <Question>
       <!--<Label IsTooltipOnly="false" TradId="123">Nombre formaté (2 décimales)</Label>-->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="FormatNumberResultat" DataType="string">
        <!--<Description>Formatage à 2 chiffres après la virgule.</Description>-->
      </TextBox>
    </Question>
    <Question>
       <!--<Label IsTooltipOnly="false" TradId="123">Nombre formaté (0 décimale)</Label>-->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="FormatNumberResultat1" DataType="string">
        <!--<Description>Formatage à 0 chiffre après la virgule.</Description>-->
      </TextBox>
    </Question>
  </QuestionSet>
</Content>
```

Source : documentation JWAY Campus, page "Math Functions" (https://campus.jway.eu/portal/documentation/step/2852).
