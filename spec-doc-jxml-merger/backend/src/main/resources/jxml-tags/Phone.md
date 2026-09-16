# Phone

Contrôler et formater la saisie d’un numéro de téléphone international, paramétrable selon le pays.

## Elément qui l'utilise

Le contrôle et le formatage des numéros de téléphone internationaux sont pris en charge par l’élément **NumberBox**, utilisé pour la saisie de valeurs numériques.

## Paramètres

- **State** : définit le pays utilisé pour appliquer le format local du numéro de téléphone (**BE**, **FR**, **LU**, **CH**, **INT**).

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">PhoneFr</Label>
  <TextBox RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" Name="controlOfficial|PhoneFr" DataType="string">
    <Description>Exemple : 0673676957</Description>
    <Control Type="Phone" ErrorType="error">
      <Parameter Name="state" Value="FR" />
    </Control>
  </TextBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "Phone" (https://campus.jway.eu/portal/documentation/step/2830).
