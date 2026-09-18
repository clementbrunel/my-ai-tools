# Fonction asNumber()

**Description** : Cette fonction retourne une valeur numérique correspondant à la valeur exprimée en Chaine de caractères.

**Forme / Appel** : asNumber(**String**) retourne une valeur de type numérique
**Paramètre[1]** : **String **: Chaîne de caractères contenant des chiffres

**Exemple **: asNumber('100')
**Résultat** : 100

```xml
<Content NewPage="none" OutputMode="all" OutputTarget="all" StyleName="">
  <Variable Expression="asNumber($(AsNumberEntree))" Submit="false" DataType="string" Name="AsNumberResultat"/>
  <QuestionSet HorizontalAlignment="left" LabelHorizontalAlignment="left" LabelPosition="auto" OutputMode="all" OutputTarget="all" Spacing="normal">
    <!--<Title>AsNumber</Title>-->
    <Question>
      <!--<Label IsTooltipOnly="false" TradId="117">Entrer chaine de caractère contenant les chiffres</Label>-->
      <TextBox RefreshOnExit="true" NumberOfVisibleCharacters="15" AutoSize="false" Name="AsNumberEntree" DataType="string">
        <!--<Description>Cette fonction retourne une valeur numérique correspondant à la valeur exprimée en chaîne de caractères.</Description>-->
        <Control Type="rangeChar" ErrorType="error">
          <OnErrorMessage/>
          <Parameter Name="min" Value="10"/>
          <Parameter Name="max" Value="30"/>
        </Control>
      </TextBox>
    </Question>
    <Question IsVisible="">
      <!--<Label IsTooltipOnly="false" TradId="123">Resultat AsNumber</Label>-->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="AsNumberResultat" DataType="string"/>
    </Question>
  </QuestionSet>
</Content>
```

Source : documentation JWAY Campus, page "Math Functions" (https://campus.jway.eu/portal/documentation/step/2852).
