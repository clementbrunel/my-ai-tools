# Option B — Raspberry Pi 3 B+ en direct (Home Assistant OS)

Machine dédiée comme l'était Jeedom, matériel USB branché nativement sans souci de
passthrough. Voir le matériel existant (RFXCOM, dongle Zigbee) dans le
[README](./README.md).

Le Pi 3 B+ (1 Go RAM) est la config minimale officiellement supportée par Home Assistant.
Suffisant pour un usage "volets + capteurs + automatisations", plus juste si tu ajoutes
des flux caméra ou beaucoup d'historique. Avantage clé ici : le RFXCOM et le dongle
Zigbee se branchent nativement en USB, sans les soucis de passthrough du NAS.

## Installation

1. Télécharger **Raspberry Pi Imager**, choisir l'image officielle
   **Home Assistant OS** (image "Raspberry Pi 3"), flasher sur une carte SD (ou, mieux,
   une clé USB/SSD — plus fiable dans la durée que la SD pour l'écriture continue de la
   base recorder).
2. Démarrer le Pi, attendre ~10-20 min (première init), puis accéder à
   `http://homeassistant.local:8123`.
3. Créer le compte admin, définir nom du foyer et localisation.

## Configurer le RFXCOM (Somfy RTS)

1. Brancher le RFXtrx433E en USB sur le Pi.
2. **Paramètres > Appareils et services > Ajouter une intégration > RFXtrx** — Home
   Assistant détecte automatiquement le périphérique USB série.
3. Mettre chaque volet en mode association (bouton PROG existant sur le rail/moteur,
   comme pour apprendre une télécommande Somfy classique), puis dans HA :
   **Paramètres > Appareils > RFXtrx > Ajouter un appareil**, sélectionner "Somfy RTS" et
   suivre l'assistant d'appairage (il envoie une commande RTS que le volet apprend).
4. Chaque volet apparaît comme entité `cover.xxx`.

## Configurer le dongle Zigbee

Une fois la référence identifiée (voir le [README](./README.md)) :

- **ZHA** (recommandé pour démarrer, intégré nativement) :
  **Paramètres > Appareils et services > Ajouter une intégration > ZHA**, sélectionner
  le port série du dongle.
- **Zigbee2MQTT** (si tu veux plus de contrôle/logs, ou support d'appareils exotiques) :
  s'installe comme add-on HAOS depuis le Add-on Store, nécessite aussi l'add-on
  **Mosquitto broker**.

## Fiabilité / bonnes pratiques

- Démarrer sur clé USB/SSD plutôt que carte SD si possible (l'écriture continue de
  l'historique use les cartes SD plus vite).
- Réduire la rétention du recorder si le stockage est limité (`recorder: purge_keep_days`
  dans `configuration.yaml`).
- Sauvegardes : Add-on **Backup** natif HAOS, à exporter régulièrement vers le NAS
  (ex: partage réseau monté, ou copie manuelle du fichier `.tar` généré).
