# ComparaisonOperators

Les opérateurs de comparaison permettent de **comparer deux valeurs** (nombres ou chaînes de caractères) et de retourner un résultat booléen : **vrai **ou **faux**. Ils sont utilisés dans les conditions (**<?if … ?>**) pour exécuter une instruction selon le résultat de la comparaison.

## Liste des opérateurs logiques et de comparaison

- **==** : Égal à
- **!=** : Différent de
- **<** : Strictement inférieur
- **>** : Strictement supérieur
- **<=** : Inférieur ou égal
- **>=** : Supérieur ou égal

## Exemple de vérification d’une valeur strictement inférieure

**Description **: Vérifie qu’une valeur est strictement inférieure à une autre valeur.

**Opérateur** : **<**
**Exemple** : (**$(a) < $(b)**)

```xml
<!-- Instruction qui vérifie si la valeur de a est inférieure à la valeur de b -->
<?if ($(a) < $(b))
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est vraie</Paragraph>
<?else ?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est fausse</Paragraph>
<?end-if ?>
```

## Exemple de vérification d’une valeur strictement supérieure

**Description **: Vérifie qu’une valeur est strictement supérieure à une autre valeur.

**Opérateur** : **>**
**Exemple** : (**$(a) > $(b)**)

```xml
<!-- Instruction qui vérifie si la valeur de a est supérieure à la valeur de b -->
<?if ($(a) > $(b))
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est vraie</Paragraph>
<?else ?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est fausse</Paragraph>
<?end-if ?>
```

## Exemple de vérification d’une valeur inférieure ou égale

**Description **: Vérifie qu'une valeur est inférieure ou égale à une valeur.

**Opérateur** : **<=**
**Exemple** : (**$(a) <= $(b)**)

```xml
<!-- Instruction qui vérifie si la valeur de a est inférieure ou égale à la valeur de b -->
<?if ($(a) <= $(b))
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est vraie</Paragraph>
<?else ?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est fausse</Paragraph>
<?end-if ?>
```

## Exemple de vérification d’une valeur supérieure ou égale

**Description :** Vérifie qu’une valeur est supérieure ou égale à une autre valeur. Cette comparaison est vraie si la première valeur est strictement supérieure ou exactement égale à la seconde.

**Opérateur** : **>=**
**Exemple** : (**$(a) >= $(b)**)

```xml
 <!-- Instruction qui vérifie si la valeur de a est supérieure ou égale à la valeur de b -->
<?if ($(a) >= $(b))
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est vraie</Paragraph>
<?else ?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est fausse</Paragraph>
<?end-if ?>
```

## Exemple de vérification de l’égalité entre deux valeurs

**Description :** Vérifie si deux valeurs sont identiques. La comparaison est vraie lorsque la valeur de gauche est exactement égale à celle de droite.

**Opérateur** : **==**
**Exemple** : (**$(a) == $(b)**)

```xml
<!-- Instruction qui vérifie si la valeur de a est égale à la valeur de b -->
<?if ($(a) == $(b))
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est vraie</Paragraph>
<?else ?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est fausse</Paragraph>
<?end-if ?>
```

## Exemple de vérification de la différence entre deux valeurs

**Description :** Vérifie si deux valeurs sont différentes. La comparaison est vraie lorsque la valeur de gauche n’est pas égale à celle de droite.

**Opérateur** : **!=**
**Exemple** : (**$(a) != $(b)**)

```xml
<!-- Instruction qui vérifie si la valeur de a est différente de la valeur de b -->
<?if ($(a) != $(b))
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est vraie</Paragraph>
<?else ?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est fausse</Paragraph>
<?end-if ?>
```

Source : documentation JWAY Campus, page "ComparaisonOperators" (https://campus.jway.eu/portal/documentation/step/2846).
