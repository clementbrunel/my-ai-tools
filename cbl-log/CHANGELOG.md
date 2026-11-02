# Changelog — cbl-log

Nouveautés visibles par l'utilisateur, une section par version publiée (la plus récente en haut).
La section `## [X.Y.Z]` est reprise telle quelle comme notes de la release GitHub `cbl-log-vX.Y.Z`
et affichée dans la fenêtre « Mise à jour disponible » de l'application : rédigez-la pour un
utilisateur (pas de noms de branches, de PR ni de tâches internes).

## [3.1.0] — 2026-11-02

- **Notes de version dans l'application** : le menu Aide propose « Notes de version… », qui s'ouvre sur la version installée ; les boutons Plus ancienne / Plus récente (ou les flèches ←/→) font défiler l'historique. Les notes sont embarquées : elles restent consultables hors-ligne et après chaque mise à jour.
- **Mise à jour dans l'application** : l'offre de mise à jour, la progression du téléchargement, les erreurs et le message « à jour » s'affichent dans une fenêtre aux couleurs de l'application, au lieu des boîtes de dialogue Windows.
- Fenêtres (mise à jour, notes de version, signalement d'un bug, éditeur de règles) et boutons harmonisés : même apparence en thème clair et sombre, fermeture par Échap ou clic à l'extérieur.
- **Suivi en direct** : fin du scintillement en bas de l'écran quand un log défile vite en mode tail (les nouvelles lignes n'apparaissent plus vides avant d'être remplies).

## [3.0.0] — 2026-11-02

- **Conteneurs Docker** : un nouveau panneau (Ctrl+Maj+D) liste les conteneurs de Docker Desktop ; un double-clic ouvre ses logs dans un onglet, suivis en direct. Le suivi reprend après l'arrêt ou le redémarrage du conteneur ou de Docker Desktop, et un conteneur recréé (`docker compose up`) reste dans le même onglet, avec un séparateur. « Charger plus d'historique » remonte plus loin. La copie locale des logs est plafonnée (256 Mo par défaut, réglable) et supprimée à la fermeture de l'onglet.
- **Onglet « Tout »** : les fichiers ouverts sont entrelacés par horodatage, chacun avec sa couleur et une case pour l'afficher ou le masquer ; recherche, filtre et navigation fonctionnent dedans, et il suit les fichiers en direct. Il s'ouvre immédiatement sur les dernières lignes (une fenêtre de temps commune à tous les fichiers) ; « Charger plus d'historique » remonte plus loin, jusqu'à tout l'historique. L'onglet est épinglé à droite de la barre d'onglets.
- **Aller à une heure** : Ctrl+G accepte désormais une heure (`10:02`, `2026-10-14 10:02:11`) en plus d'un numéro de ligne.
- Les fichiers archivés par la rotation du dossier sont chargés avant le fichier courant ; la recherche et le filtre couvrent tout le flux, archives comprises, et celles-ci restent lisibles même nombreuses.
- L'affichage suit les fichiers en cours d'écriture environ deux fois plus vite (≈ 60 ms au lieu de ≈ 150 ms en médiane).
- Un indicateur de chargement apparaît pour les opérations qui durent plus d'une demi-seconde (ouverture, fusion de l'onglet « Tout », recherche, filtre).
- Corrections : le suivi reprend après une mise en veille de Windows ; les couleurs de niveau sont conservées dans la vue filtrée avec un filtre texte seul.

## [2.1.0] — 2026-10-22

- Clic droit sur le chemin du fichier : ouvrir le dossier, afficher dans l'explorateur, copier le chemin.
- Les onglets peuvent être renommés ; les noms sont conservés d'une session à l'autre.
- Export / import d'un profil de surlignage pour le partager entre collègues.
- Nouveau panneau Aide > Signaler un bug / proposer une idée.
- Mise à jour : la fenêtre n'affiche plus que les nouveautés, et cbl-log re-vérifie les mises à jour toutes les heures (plus seulement au démarrage).
- Installeur plus léger (seules les langues fr / en-US sont conservées).

## [2.0.0] — 2026-10-20

- Nouvelle interface façon Windows 11 : barre d'onglets, barre de commandes et barre d'état redessinées.
- Les filtres passent à la ligne quand ils manquent de place ; l'encodage est affiché à côté du chemin ; Pause / Suivre restent en bas à droite.
- Les règles de surlignage se réordonnent par glisser-déposer.
- Écran de démarrage et fenêtre « À propos ».
- Nouvelle icône, claire ou sombre selon le thème de Windows.

## [1.1.0] — 2026-10-19

- Mise à jour intégrée : cbl-log signale les nouvelles versions et les installe lui-même (Aide > Rechercher une mise à jour).

## [1.0.1] — 2026-10-19

- Correction : les lignes vides n'apparaissent plus soulignées en bleu dans la vue filtrée.

## [1.0.0] — 2026-10-19

- Première version publique.
