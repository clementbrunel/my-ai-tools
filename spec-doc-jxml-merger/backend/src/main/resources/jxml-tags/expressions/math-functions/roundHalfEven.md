# Fonction roundHalfEven()

**Description** : Cette fonction retourne un arrondi de la valeur numérique fournie en entrée. Elle fonctionne comme la méthode round, à la différence que lorsque la valeur à arrondir contient un **5**, elle est arrondie **au nombre pair le plus proche** (on parle d’arrondi bancaire).
Cette méthode est utilisée pour éviter les erreurs cumulées lors de calculs successifs sur plusieurs valeurs.

**Forme / Appel** : roundHalfEven(**Double**, **Integer**) retourne une valeur de type **Double**
**Paramètre[1] **: **Double** : Valeur à arrondir
**Paramètre[2]** : **Integer **: Nombre de décimales

**Exemple** : roundHalfEven(10.256, 2)
**Résultat **: 10.26

```xml
<Content NewPage="none" OutputMode="all" OutputTarget="all" StyleName="">
  <!--Variable : calcule l'arrondi de 10.256 à 2 décimales avec la méthode roundHalfEven-->
  <Variable Expression="roundHalfEven(10.256, 2)" Submit="false" DataType="double" Name="RoundHalfEvenExemple"/>
  <QuestionSet HorizontalAlignment="left" LabelHorizontalAlignment="left" LabelPosition="auto" OutputMode="all" OutputTarget="all" Spacing="normal">
    <!--<Title>Exemple roundHalfEven()</Title>-->
    <!--Résultat de l'arrondi-->
    <Question>
      <!--<Label IsTooltipOnly="false">Résultat de roundHalfEven(10.256, 2)</Label>-->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="RoundHalfEvenExemple" DataType="string">
        <!--<Description>Le résultat affiché doit être 10.26</Description>-->
      </TextBox>
    </Question>
  </QuestionSet>
</Content>
```

Source : documentation JWAY Campus, page "Math Functions" (https://campus.jway.eu/portal/documentation/step/2852).
