# FormServices Function

Ces fonctions permettent d’obtenir automatiquement les liens associés à un dossier, un rapport ou un service (PDF, HTML, pièces jointes, etc.). Elles facilitent l’accès et la navigation entre les différentes ressources de l’application.

## **Liste des fonctions disponibles**

- **openUrl()** : Retourne le lien de reprise du dossier (cas authentifié)
- **detailUrl()** : Retourne le lien de détail du dossier (cas authentifié)
- **openPublicUrl(Boolean)** : Retourne le lien de reprise du dossier pour l’étape suivante (cas public)
- **detailPublicUrl(Boolean)** : Retourne le lien de détail du dossier pour l’étape suivante (cas public)
- **getReportUrl()** : Retourne le lien du rapport PDF associé au dossier
- **getHtmlReportUrl()** : Retourne le lien du rapport HTML associé au dossier
- **getPortalUrl()** : Retourne le lien de la racine du portail ForServices
- **getAttachmentUrl()** : Retourne le lien du service de gestion des pièces jointes

## Fonction isStep()

**Description **: Cette fonction vérifie si l’étape en cours appartient à la liste d’étapes passée en paramètre.

**Syntaxe** : isStep(**String**, **String**) retourne une valeur de type **Boolean**

**Paramètre[1] **: **String **: Première étape à comparer

**Paramètre[2] **: **String **: Deuxième étape à comparer

**Exemple** : isStep('initialisation', 'validation')
// Retourne true si l’étape actuelle est “initialisation” ou “validation

## Fonction openUrl()

**Description **: Cette fonction retourne le lien de reprise du dossier dans le cas d’un utilisateur authentifié.

**Syntaxe **: openUrl() retourne une valeur de type **String**

**Exemple **: openUrl()

## Fonction detailUrl()

**Description **: Cette fonction retourne le lien de détail du dossier dans le cas d’un utilisateur authentifié.

**Syntaxe **: detailUrl() retourne une valeur de type **String**

**Exemple **: detailUrl()

## Fonction openPublicUrl()

**Description **: Cette fonction retourne le lien de reprise du dossier pour l’étape suivante (cas public).

**Syntaxe **: openPublicUrl(**Boolean**) retourne une valeur de type **String**

**Paramètre[1] **: **Boolean **: True pour étape suivante false pour étape en cours (permet de choisir le **token **à utiliser)

**Exemple **: openUrlNextStep(false)

## Fonction detailPublicUrl()

**Description **: Cette fonction retourne le lien de détail du dossier pour l’étape suivante (cas public).

**Syntaxe **: detailPublicUrl(**Boolean**) retourne une valeur de type **String**

**Paramètre[1]** : **Boolean **: True pour étape suivante false pour étape en cours (permet de choisir le token à utiliser)

**Exemple **: detailUrlNextStep(false)

## Fonction getReportUrl()

**Description **: Cette fonction retourne le lien du rapport **PDF **associé au dossier.

**Syntaxe **: **getReportUrl()** retourne une valeur de type **String**

**Exemple **: getReportUrl()

## Fonction getHtmlReportUrl()

**Description **: Cette fonction retourne le lien du rapport HTML associé au dossier.

**Syntaxe **: **getHtmlReportUrl()** retourne une valeur de type **String**

**Exemple **: getHtmlReportUrl()

## Fonction getPortalUrl()

**Description **: Cette fonction retourne le lien de la racine du portail **ForServices.**

**Syntaxe **: **getPortalUrl()** retourne une valeur de type **String**

**Exemple **: getPortalUrl()

## Fonction getAttachmentUrl()

**Description **: Cette fonction retourne le lien du service de gestion des pièces jointes.

**Syntaxe **: **getAttachmentUrl()** retourne une valeur de type **String**

**Exemple **: getAttachmentUrl()

Source : documentation JWAY Campus, page "FormServices Function" (https://campus.jway.eu/portal/documentation/step/2849).
