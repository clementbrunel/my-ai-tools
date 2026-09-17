# Fonction contains()

**Description **: Cette fonction retourne une valeur booléenne (true ou false) indiquant si la chaîne de caractères contient la chaîne recherchée.

**Syntaxe **: contains(**String**, **String**) retourne une valeur de type **Boolean**

**Paramètre[1] **: **String **: Chaîne de caractères dans laquelle s’effectue la recherche (who)

**Paramètre[2] **: **String **: Chaîne de caractères recherchée (Mister)

**Exemple** : who = 'Mister J' ; contains($(who), 'Mister') **Résultat **: true

```xml
<QuestionSet HorizontalAlignment="left" 
             LabelHorizontalAlignment="left" 
             LabelPosition="auto" 
             OutputMode="all" 
             OutputTarget="all" 
             Spacing="normal">

  <Title>contains</Title>

  <Question>
    <Label IsTooltipOnly="false" TradId="117">Standard / List</Label>
    <ListBox DataType="string" 
             MultiValues="checkbox" 
             Name="StandardList" 
             NumberOfVisibleRows="5" 
             OptionsPerLine="2" 
             RefreshOnExit="true">
      <Description>
        Cette fonction retourne une valeur booléenne indiquant si la chaîne de caractères contient la chaîne recherchée.
      </Description>
      <Option TradId="118" Value="Box1">Box1</Option>
      <Option TradId="119" Value="Box2">Box2</Option>
      <Option TradId="120" Value="Box3">Box3</Option>
      <Option TradId="121" Value="Box4">Box4</Option>
      <Option TradId="122" Value="AutreOption">Autre option</Option>
    </ListBox>
  </Question>

  <!-- La question est visible si la liste contient le choix Box1, Box2 ou Box3 -->
  <Question IsVisible="(contains($(StandardList),'Box1') || contains($(StandardList),'Box2') || contains($(StandardList),'Box3'))">
    <Label IsTooltipOnly="false" TradId="123">Précisez le nombre de Box</Label>
    <TextBox AutoSize="false" 
             DataType="string" 
             Name="StandardListAutre" 
             NumberOfVisibleCharacters="15" 
             RefreshOnExit="true" />
  </Question>

</QuestionSet>
```

Source : documentation JWAY Campus, page "Text Functions" (https://campus.jway.eu/portal/documentation/step/2853).
