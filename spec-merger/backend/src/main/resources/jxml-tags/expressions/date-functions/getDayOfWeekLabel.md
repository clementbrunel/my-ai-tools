# Fonction getDayOfWeekLabel()

**Description **: Retourne le libellé du jour de la semaine.

**Forme / Appel** : getDayOfWeekLabel(**Date**) retourne une chaîne de caractères (**String**)
**Paramètre[1]** : **Date**

**Exemple **: getDayOfWeekLabel($(date))

```xml
<Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">
  <!-- GetDayOfWeekLabel avec paramètre -->
  <!-- Donnée qui affiche le libellé du jour de la semaine passée en paramètre -->
  <Data Expression="getDayOfWeekLabel($(date))" DataType="string" />
</Paragraph>
```

**Description** : Retourne le libellé du jour de la semaine courante.

**Forme / Appel** : getDayOfWeekLabel() retourne une chaîne de caractères (**String**)

**Exemple **: getDayOfWeekLabel()

```xml
<Paragraph OutputMode="all" Spacing="normal" OutputTarget="all">
  <!-- GetDayOfWeekLabel (current) -->
  <!-- Donnée qui affiche le libellé du jour de la semaine courante -->
  <Data Expression="getDayOfWeekLabel()" DataType="string" />
</Paragraph>
```

Source : documentation JWAY Campus, page "Date Functions" (https://campus.jway.eu/portal/documentation/step/2848).
