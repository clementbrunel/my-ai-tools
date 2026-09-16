# LimitFileSize

Contrôler qu’un champ de type **UploadBox **passe en erreur si la taille du fichier chargé dépasse la valeur définie par le paramètre **maxSizeAllowed**, exprimée en octets.

## Élément qui l’utilise

- **UploadBox**

## Paramètres

- **MaxSizeAllowed **: Taille maximale de la pièce chargée (exprimée en octets)

## Exemple de code JXML

```xml
<Question>
  <Label IsTooltipOnly="false">Téléversez votre diplôme</Label>
  <UploadBox RefreshOnExit="false" NumberOfVisibleCharacters="15" AutoSize="false" Name="Control|LimitFileSize">
    <Description>Taille Max du fichier : 1024 octets</Description>
    <Control Type="limitFileSize" ErrorType="error">
      <Parameter Name="maxSizeAllowed" Value="1024" />
    </Control>
  </UploadBox>
</Question>
```

## Mode flow

## Rendu visuel

Source : documentation JWAY Campus, page "LimitFileSize" (https://campus.jway.eu/portal/documentation/step/2822).
