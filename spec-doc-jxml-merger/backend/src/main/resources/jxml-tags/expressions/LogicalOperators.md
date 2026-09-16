# Logical Operators

Les opérateurs logiques permettent de **combiner ou de modifier des expressions booléennes**. Le résultat obtenu est toujours une valeur booléenne (**true **ou **false**). Ils facilitent la création d’une logique conditionnelle complexe et la prise de décision basée sur plusieurs critères.

## Liste des opérateurs logiques

- **&&** : **ET** logique
- **||** : **OU** logique
- **! **: **NON** logique

## Exemple : opérateur ET logique (&&)

**Description** : Retourne **true **uniquement si les deux conditions sont vraies, sinon retourne **false**.
**Opérateur** : **&&**
**Exemple** : (**$(a) == '1'**) **&&** (**$(b) == '0'**)

```xml
<!-- Vérifie si les deux conditions sont vraies -->
<?if (($(a)=='1')&&($(b)=='0'))?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est vraie</Paragraph>
<?else ?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est fausse</Paragraph>
<?end-if ?>
```

## Table de vérité (ET logique)

Expression 1Opérateur ETExpression 2Résultattrue&&truetruetrue&&falsefalsefalse&&truefalsefalse&&falsefalse

## Exemple : opérateur OU logique (||)

**Description** : Retourne **true **si au moins une des deux conditions est vraie, sinon retourne **false**.
**Opérateur** : ||
**Exemple** : (**$(a) == '1'**) **||** (**$(b) == '0'**)

```xml
<!-- Vérifie si au moins une des deux conditions est vraie -->
<?if (($(a)=='1')||($(b)=='0'))?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est vraie</Paragraph>
<?else ?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est fausse</Paragraph>
<?end-if ?>
```

## Table de vérité (OU logique)

Expression 1Opérateur OUExpression 2Résultattrue||truetruetrue||falsetruefalse||truetruefalse||falsefalse

## Exemple : opérateur NON logique (!)

**Description** : Retourne **true **si la condition est fausse, sinon retourne **false**.
**Opérateur** : **!**
**Exemple** :** !**(**$(a) == '10'**)

```xml
<!-- Vérifie si la valeur de a est différente de 10 -->
<?if !($(a)=='10')?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est vraie</Paragraph>
<?else ?>
  <Paragraph OutputMode="all" OutputTarget="all" Spacing="normal" TradId="">L'expression est fausse</Paragraph>
```

Source : documentation JWAY Campus, page "Logical Operators" (https://campus.jway.eu/portal/documentation/step/2851).
