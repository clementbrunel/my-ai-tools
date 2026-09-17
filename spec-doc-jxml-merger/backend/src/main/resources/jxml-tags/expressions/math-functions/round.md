# Fonction round()

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

Source : documentation JWAY Campus, page "Math Functions" (https://campus.jway.eu/portal/documentation/step/2852).
