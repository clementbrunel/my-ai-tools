# IteratorControlButton

L’élément **IteratorControlButton** permet de modifier dynamiquement le nombre d’éléments gérés par un **DataIterator**.
Il facilite la gestion d’une collection de taille variable en ajoutant ou supprimant des lignes. Cet élément s’utilise dans le cadre d’une itération, par exemple pour poser des boutons permettant à l’utilisateur d’ajouter ou de supprimer des champs dans une table ou un contenu répété.

## Liste des attributs

- **StyleName** (Liste ouverte) : Permet de choisir un style prédéfini dans la liste déroulante
- **TradId** : Identifiant technique, zone non modifiable
- **Type** : Définit l’action du bouton :**InsertBefore** : Ajoute un élément avant**InsertAfter** : Ajoute un élément après**Delete** : Supprime un élément

## **Exemple de code** **JXML**

```xml
<Content OutputMode="all" OutputTarget="all" NewPage="none">
  <DataIterator AddInsert="false" DataPath="ETUDIANTS" InternalName="item" MaxItemAllowed="" />
  <QuestionSet OutputMode="all" LabelHorizontalAlignment="left" LabelPosition="auto" Spacing="normal" OutputTarget="all" HorizontalAlignment="left">
    <Question>
      <Label IsTooltipOnly="false">Nom</Label>
      <TextBox Name="item|Nom" RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" />
    </Question>
    <Question>
      <Label IsTooltipOnly="false">Prénom</Label>
      <TextBox Name="item|Prenom" RefreshOnExit="false" NumberOfVisibleCharacters="15" DataType="string" AutoSize="false" />
    </Question>
  </QuestionSet>
  <Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">
    <IteratorControlButton Type="insertBefore" StyleName="text">Ajouter avant</IteratorControlButton>
    <IteratorControlButton Type="delete" StyleName="">Supprimer</IteratorControlButton>
    <IteratorControlButton Type="insertAfter">Ajouter après</IteratorControlButton>
  </Paragraph>
</Content>
```

## Mode flow

## Rendu visuel

## Structure parente

Source : documentation JWAY Campus, page "IteratorControlButton" (https://campus.jway.eu/portal/documentation/step/2850).
