# Math Functions

Ces fonctions permettent d’effectuer différentes opérations sur les nombres, comme arrondir une valeur, calculer un reste de division, convertir une chaîne de caractères en nombre ou encore formater un montant selon une précision ou une devise. Elles facilitent la manipulation et la présentation des données numériques dans les formulaires.

## Liste des fonctions disponibles

- **round(Value, Decimales) **: Arrondit une valeur numérique selon le nombre de décimales indiqué
- **roundHalfEven(Value, Decimales)** : Arrondit une valeur numérique à la décimale paire la plus proche (arrondi bancaire)
- **modulo(Dividende, Diviseur) **: Retourne le reste de la division du dividende par le diviseur
- **asNumber(String) **: Convertit une chaîne de caractères contenant des chiffres en valeur numérique
- **formatNumber(Value, Decimales) **: Formate une valeur numérique avec le nombre de décimales souhaité
- **getCurrency(Value, CodeDevise) **: Renvoie la valeur d’un montant associée à une devise (ex. **EUR**, **USD**)
- **getCurrency(Value, CodeDevise, Decimales) **: Renvoie la valeur d’un montant associée à une devise, avec le nombre de décimales spécifié

## Exemple d’utilisation de la fonction round()

**Description** : Cette fonction retourne un arrondi de la valeur numérique fournie en entrée. 01234 sont arrondi a l'inferieur, 56789 sont arrondi au supérieur.

**Forme / Appel** : round(**Double**, **Integer**) **retourne **une valeur de type **double**
**Paramètre[1] **: **Double **: Valeur à arrondir
**Paramètre[2]** : **Integer **: Nombre de décimales

**Exemple **: round(10.265, 2) 
**Résultat** : 10.27

```xml
<Content NewPage="none" OutputMode="all" OutputTarget="all" StyleName="">
  <!-- Variable : calcule l'arrondi de 10.265 à 2 décimales -->
  <Variable Expression="round(10.265, 2)" Submit="false" DataType="double" Name="RoundExemple"/>
  <QuestionSet HorizontalAlignment="left" LabelHorizontalAlignment="left" LabelPosition="auto" OutputMode="all" OutputTarget="all" Spacing="normal">
    <!-- <Title>Exemple round()</Title> -->
    <!-- Résultat de l'arrondi -->
    <Question>
      <!-- <Label IsTooltipOnly="false">Résultat de round(10.265, 2)</Label> -->
      <TextBox DefaultValue="" RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" IsReadOnly="true" Name="RoundExemple" DataType="string">
        <!-- <Description>Le résultat affiché doit être 10.27</Description> -->
      </TextBox>
    </Question>
  </QuestionSet>
</Content>
```

## Exemple d’utilisation de la fonction **roundHalfEven()**

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

## Exemple d’utilisation de la fonction modulo()

**Description** : Cette fonction retourne une valeur numérique correspondant au **reste de la division euclidienne** du dividende par le diviseur. Elle permet donc d’obtenir la partie restante d’une division entre deux nombres entiers.

**Forme / Appel** : modulo(**Integer**, **Integer**) retourne une valeur de type **Integer**
**Paramètre[1]** : **Integer** : Dividende
**Paramètre[2]**: **Integer** : Diviseur

**Exemple **: modulo(10, 3) 
**Résultat **: 1

```xml
<Variable Expression=" modulo($(ModuloDividende),$(ModuloDiviseur))" Submit="false" DataType="integer" Name="ModuloResultat" />
```

## Exemple d’utilisation de la fonction asNumber()

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

## Exemple d’utilisation de la fonction formatNumber()

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

## Exemple d’utilisation de la fonction getCurrency()

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
