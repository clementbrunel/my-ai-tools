# Changelog — prono-core

Historique des fonctionnalités et correctifs notables, ordonné par date décroissante et groupé par mois.

---

## Juin 2026 (15)

### Fonctionnalités
- **Recherche plein texte** sur l'écran des matchs
- **Vue grille / liste** sur la liste des matchs (toggle)
- **Classement — drill-down** : clic sur une ligne pour voir les paris du joueur dans le groupe
- **Gages en attente** visibles dans la vue groupe du classement
- **Annotation AOP `@LoggedAt`** : journalisation automatique des entrées de contrôleur (utilisateur + endpoint)
- **Refactor frontend** : `Admin`, `GroupPage`, `Profile`, `MatchDetail` découpés en sous-composants ; hook `useFormMessages` extrait

### Correctifs
- Classement : seuls les paris sur des matchs passés comptent dans le score affiché
- Onglet "À venir" sélectionné par défaut ; "Tous" déplacé en dernier

---

## Juin 2026 (8–14)

### Fonctionnalités
- **Rappels email** : un seul mail par utilisateur par jour, envoyé 4 h avant le coup d'envoi
- **Réinitialisation de mot de passe** : flow complet frontend + backend avec email dédié (Resend)
- **Vérification d'email** : colonne `emailVerified` + modal de déblocage dans la liste admin des utilisateurs
- **Force-settle global** : bouton "Recalculer" en admin pour recalculer tous les paris d'un match
- **Force-settle gage du jour** : possibilité de forcer le règlement après coup
- **Édition de gage** dans la vue admin
- **Endpoint `/api/admin/counts`** : badges d'alerte centralisés dans la navbar admin
- **Déploiement NAS Synology** : workflow GitHub Actions + scripts build/push vers le registre local

### Correctifs
- Participations manquantes backfillées lors du force-settle
- `ForfeitService` : upsert atomique pour éviter les doublons sous concurrence
- `BetService` : déduplication des participations par utilisateur dans `getParticipationsByMatch`
- `MatchDetail` : suppression des doubles appels API au montage (race condition auth)
- Rappels : exclusion des matchs déjà commencés
- Emails : domaine expéditeur corrigé vers `app.prono-core.top` (domaine vérifié Resend)
- Erreur 401 sur `/error` corrigée (Spring Security)
- Score par défaut 0-0 sur la page de saisie de pronostic

---

## Juin 2026 (1–7)

### Fonctionnalités
- **Gages scopés au groupe** : chaque groupe a ses propres gages (partagés + privés), le `bettorBonus` global est supprimé
- **Gage du jour par groupe** : chaque groupe configure son propre forfeit du jour
- **Délégation aux admins de groupe** : ouverture des paris par compétition, gestion des gages
- **Découverte de groupes** : recherche, bascule public/privé, candidatures avec badge d'attente dans la navbar
- **Modales natives remplacées** : `alert`/`confirm` remplacés par des modales React propres (`ConfirmModal`)
- **Sélecteur d'emoji** sur le formulaire de proposition de gage
- **Colonne Compétition** dans le tableau des matchs en admin
- **Badges de notification** sur les boutons admin des groupes (candidatures, gages à valider)
- **Classement et points par groupe** affichés sur le dashboard
- **Mise à jour avatar et mot de passe** depuis le profil utilisateur
- **Suppression automatique du groupe** quand le dernier membre part (au lieu d'une erreur 409)

### Correctifs
- Sérialisation JSON de `isPrivate` corrigée pour le toggle public/privé
- Filtre matchs : seuls les matchs avec paris ouverts dans les groupes de l'utilisateur
- Badge navbar groupe : route corrigée (`/group` → `/groups`)
- Admin gage du jour : affichage de tous les groupes, pas uniquement ceux administrés
- Comptage des matchs à venir sur le dashboard (déduplication)

---

## Mai 2026

### Fonctionnalités
- **1 pronostic par match** : auto-création du pari au premier pronostic, upsert à chaque modification
- **Système de gages du jour** (`DailyGage`) : forfeit configurable par journée, avec mode vote ou direct
- **Système de score +5 / +3 / +0** (score exact / bonne tendance / raté)
- **Groupes de jeu** : page groupe avec code d'invitation, classement par groupe, rôle `PLATFORM_ADMIN` pour créer des groupes
- **Panel d'aide sur les règles** sur la page de création de pronostic
- **Profil** : historique des paris (participés)
- **Drapeaux** : images via `flagcdn.com` pour tous les 48 pays de la Coupe du Monde 2026 (remplacement des emojis, incompatibles multi-plateforme)
- **Deadline automatique** = heure de coup d'envoi du match (plus de saisie manuelle)
- **Regroupement des matchs par journée** sur la liste principale

### Correctifs
- Boucle de redirection login (401 sur les endpoints `daily-gage` GET) corrigée
- Rang affiché en double pour les positions ≥ 4 dans le classement
- Format de date DD/MM/YYYY appliqué partout
- Sérialisation enum JPQL (`@Param`) corrigée pour éviter un bug Hibernate
