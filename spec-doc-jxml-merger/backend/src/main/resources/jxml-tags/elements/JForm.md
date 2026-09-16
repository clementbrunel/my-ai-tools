# JForm

Élément racine permettant de décrire un formulaire Jway. Regroupe à la fois les pages (`Section`) et les éléments périphériques (`MetaField` / `MetaContent`) qui le composent.

## Attributs

| Attribut | Type | Description |
|---|---|---|
| `Language` | — | Choix de la langue. Définit tous les segments de texte (hors JXML) du formulaire, comme les textes des boutons, etc. |
| `Nature` | — | `form` (formulaire interactif), `PDF`, `notice`, `glossaire`, etc. |

## Remarques

Attention : la langue projet et la langue JXML doivent être en accord.

## Exemple de code JXML

```xml
<?xml version="1.0" encoding="utf-8"?>
<JForm Language="fr" Nature="form">
  <Title>Exemple de jform</Title>
  <Resources />
  <Section>
    <Title>Section</Title>
  </Section>
</JForm>
```

Source : documentation JWAY Campus, page "JForm" (https://campus.jway.eu/portal/documentation/step/2772).
