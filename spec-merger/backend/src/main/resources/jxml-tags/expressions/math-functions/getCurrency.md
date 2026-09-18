# Fonction getCurrency()

**Description** : Cette fonction retourne une valeur de type **Currency** à partir d’une valeur numérique et d’un code de devise. Elle permet d’afficher un montant formaté selon la devise choisie (exemple : **EUR**, **USD**, **CHF**, etc.).

**Forme / Appel** : getCurrency(**Value**, **String**) ) retourne une valeur de type **String**
**Paramètre[1] **: **Value **: Valeur numérique
**Paramètre[2]** : **String **: Code ISO de la devise

**Exemple **: getCurrency('102536', 'EUR')
**Résultat **: 102 536,00 €

```xml
<Content NewPage="none" OutputMode="all" OutputTarget="all" StyleName="">
  <!--Variables : retourne la valeur formatée selon la devise-->
  <Variable Expression="getCurrency($(GetCurrency1Value),'EUR')" Submit="false" DataType="string" Name="GetCurrency1Resultat1"/>
  <Variable Expression="getCurrency($(GetCurrency1Value),'USD')" Submit="false" DataType="string" Name="GetCurrency1Resultat2"/>
  <Variable Expression="getCurrency($(GetCurrency1Value),'CHF')" Submit="false" DataType="string" Name="GetCurrency1Resultat3"/>
  <Variable Expression="getCurrency($(GetCurrency1Value),'GBP')" Submit="false" DataType="string" Name="GetCurrency1Resultat4"/>
  <Variable Expression="getCurrency($(GetCurrency1Value),'XAF')" Submit="false" DataType="string" Name="GetCurrency1Resultat5"/>

  <QuestionSet HorizontalAlignment="left" LabelHorizontalAlignment="left" LabelPosition="auto"
               OutputMode="all" OutputTarget="all" Spacing="normal">
    <!--<Title>GetCurrency</Title>-->

    <Question>
       <!--<Label IsTooltipOnly="false" TradId="117">Entrer une valeur</Label>-->
      <NumberBox RefreshOnExit="true" Name="GetCurrency1Value" FractionDigits="0" NumberOfVisibleCharacters="15" AutoSize="false">
        <!--<Description>Entrer un nombre</Description>-->
      </NumberBox>
    </Question>

    <Question>
      <!--<Label IsTooltipOnly="false" TradId="123">GetCurrency EUR</Label>-->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="GetCurrency1Resultat1" DataType="string"/>
    </Question>

    <Question IsVisible="false">
     <!--<Label IsTooltipOnly="false" TradId="123">GetCurrency USD</Label>-->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="GetCurrency1Resultat2" DataType="string">
        <!--<Description>Formatage à 2 chiffres après la virgule.</Description>-->
      </TextBox>
    </Question>

    <Question IsVisible="false">
      <!--<Label IsTooltipOnly="false" TradId="123">GetCurrency CHF</Label>-->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="GetCurrency1Resultat3" DataType="string">
       <!--<Description>Formatage à 2 chiffres après la virgule.</Description>-->
      </TextBox>
    </Question>

    <Question IsVisible="false">
       <!--<Label IsTooltipOnly="false" TradId="123">GetCurrency GBP</Label>-->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="GetCurrency1Resultat4" DataType="string">
       <!--<Description>Formatage à 2 chiffres après la virgule.</Description>-->
      </TextBox>
    </Question>

    <Question IsVisible="false">
       <!--<Label IsTooltipOnly="false" TradId="123">GetCurrency XAF</Label>-->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="GetCurrency1Resultat5" DataType="string">
       <!--<Description>Formatage à 2 chiffres après la virgule.</Description>-->
      </TextBox>
    </Question>
  </QuestionSet>
</Content>
```

Source : documentation JWAY Campus, page "Math Functions" (https://campus.jway.eu/portal/documentation/step/2852).
