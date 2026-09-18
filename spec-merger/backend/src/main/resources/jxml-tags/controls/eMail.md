# eMail

Le contrôle du format d’une adresse e-mail permet de garantir la validité des informations saisies par l’utilisateur. Il vérifie que la valeur entrée respecte la structure standard d’une adresse électronique avant de valider le champ.

## Structure d’une adresse e-mail valide

**Nom d’utilisateur** : une suite de caractères (par ex. [prenom.nom](https://campus.jway.eu/portal/documentation/step/prenom.nom)).**Symbole **[**@**](https://campus.jway.eu/portal/documentation/step/@) : séparateur obligatoire.**Nom de domaine** : domaine valide (par ex. fournisseur.pays).
Exemple correct :[ prenom.nom@fournisseur.pays](https://campus.jway.eu/portal/documentation/step/prenom.nom@fournisseur.pays)

Si le format n’est pas respecté, un **message d’erreur est affiché par défaut** pour signaler l’adresse incorrecte.

## Élément qui l’utilise

Ce contrôle s’emploie dans un élément de type **TextBox **(champ de saisie).

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Email</Label>
  <TextBox 
    Name="controlInternet|Email" RefreshOnExit="false" 
    DataType="string" NumberOfVisibleCharacters="50" 
    IsRequired="false" AutoSize="false" IsEnabled="" IsReadOnly="">
    <Control ErrorType="error" Type="Email" />
  </TextBox>
</Question>
```

## Mode flow

Source : documentation JWAY Campus, page "eMail" (https://campus.jway.eu/portal/documentation/step/2809).
