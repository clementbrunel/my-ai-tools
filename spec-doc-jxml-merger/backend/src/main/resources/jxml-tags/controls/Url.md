# Url

QPermet de vérifier que la valeur saisie correspond au format d’une adresse URL (Uniform Resource Locator). Une URL (Uniform Resource Locator) est un identifiant unique utilisé pour localiser une ressource sur Internet. On l’appelle également adresse Web.

## Elle est composée de plusieurs parties, notamment

- Un **protocole** (**http**, **https**…)
- Un **nom de domaine** (example.com)
- Eventuellement un **chemin ou des paramètres** (/page?id=1)

## **Élément qui l’utilise**

- **TextBox** : pour la saisie de texte court

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">URL</Label>
  <TextBox Name="controlInternet|url" RefreshOnExit="false" DataType="string" NumberOfVisibleCharacters="50" IsRequired="false" AutoSize="false" IsEnabled="!$(disable)" IsReadOnly="$(readOnly)">
    <Control ErrorType="error" Type="url" />
  </TextBox>
</Question>
```

## Mode flow

Source : documentation JWAY Campus, page "Url" (https://campus.jway.eu/portal/documentation/step/2842).
