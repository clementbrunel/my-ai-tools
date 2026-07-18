# my-house

Configuration domotique personnelle : Home Assistant, en remplacement de l'ancienne
config Jeedom (abandonnée). Deux options de déploiement documentées en parallèle :

- **Option A — NAS Synology (Docker)** : mutualisé avec le reste de l'infra (`mottaret-watch`,
  `prono-core`), mais le passthrough USB vers un conteneur est capricieux sur Synology.
- **Option B — Raspberry Pi 3 B+ en direct (Home Assistant OS)** : machine dédiée comme
  l'était Jeedom, matériel USB branché nativement sans souci de passthrough.

## Matériel existant (récupéré de la config Jeedom)

- **Antenne RTS : RFXCOM RFXtrx433E (réf. 14103)** — émetteur/récepteur USB 433.92MHz,
  supporte le protocole Somfy RTS. Intégration native `RFXtrx` dans Home Assistant
  (config flow, détection USB automatique).
- **Dongle Zigbee USB** — référence à confirmer (voir plus bas comment l'identifier).

Pas besoin de racheter d'antenne RF : le RFXCOM fait à la fois RTS et peut coexister
avec le dongle Zigbee sur le même hôte.

### Identifier le dongle Zigbee

Une fois branché sur une machine Linux (Pi ou NAS en SSH) :

```bash
lsusb
# et pour le chemin stable /dev/serial/by-id/... :
ls -l /dev/serial/by-id/
```

Le nom du fabricant/chipset dans la sortie (`dresden elektronik` = Conbee,
`Silicon Labs` ou `ITead`/`Sonoff` = dongle Zigbee 3.0, `Texas Instruments` = CC2531/CC2652)
permet de savoir si tu pars sur l'intégration **ZHA** (native Home Assistant, la plus simple)
ou **Zigbee2MQTT** (plus de contrôle, nécessite Mosquitto). Envoie-moi la sortie de `lsusb`
quand tu l'as et on choisit l'intégration adaptée.

---

## Option A — Home Assistant en Docker sur le NAS Synology

### Pré-requis

1. Installer le package **Container Manager** depuis le Centre de paquets Synology (DSM 7+).
2. Activer SSH sur le NAS (Panneau de configuration > Terminal & SNMP) pour lancer
   `docker compose` en ligne de commande — l'interface graphique de Container Manager ne
   propose pas toujours le mode réseau `host`, recommandé pour Home Assistant (découverte
   réseau, mDNS, intégrations qui scannent le LAN).
3. Créer les dossiers de config :
   ```bash
   mkdir -p /volume1/docker/my-house/homeassistant
   mkdir -p /volume1/docker/my-house/esphome
   ```

### Lancer le stack

Copier `docker-compose.yml` sur le NAS, puis en SSH :

```bash
cd /volume1/docker/my-house
docker compose up -d
```

Home Assistant : `http://<ip-nas>:8123` — ESPHome (optionnel, voir plus bas) :
`http://<ip-nas>:6052`.

> Si le mode `host` pose problème sur ton modèle, repasse en `bridge` (retirer
> `network_mode: host`, ajouter `ports: ["8123:8123"]`). Tu perds juste la découverte
> auto de certains appareils réseau.

### Brancher le RFXCOM et le dongle Zigbee sur le NAS (passthrough USB)

C'est le point délicat de cette option : Container Manager ne propose pas de mapping USB
en interface graphique. Il faut passer par le `docker-compose.yml` directement, en
ajoutant les périphériques détectés :

```yaml
    devices:
      - /dev/serial/by-id/usb-RFXCOM_RFXtrx433-if00-port0:/dev/rfxtrx
      - /dev/serial/by-id/<ton-dongle-zigbee>:/dev/zigbee
```

Utilise les chemins stables `/dev/serial/by-id/...` (pas `/dev/ttyUSB0`, qui peut changer
d'ordre au reboot). Si le NAS ne détecte pas les périphériques USB série au reboot du
conteneur (fréquent sur certains modèles Synology), c'est le principal argument pour
préférer l'**Option B** avec ces deux périphériques.

### Alternative sans passthrough : ESPHome pour le RTS uniquement

Si le passthrough du RFXCOM vers le NAS ne fonctionne pas de façon fiable, il reste
possible de piloter les volets sans lui via un petit module ESP32 + CC1101 flashé avec
ESPHome (déjà inclus dans le `docker-compose.yml`), indépendant du NAS. Détails dans
la section RTS de l'Option B ci-dessous (le principe ESPHome est identique, seule la
question du passthrough change).

---

## Option B — Raspberry Pi 3 B+ en direct (Home Assistant OS)

Le Pi 3 B+ (1 Go RAM) est la config minimale officiellement supportée par Home Assistant.
Suffisant pour un usage "volets + capteurs + automatisations", plus juste si tu ajoutes
des flux caméra ou beaucoup d'historique. Avantage clé ici : le RFXCOM et le dongle
Zigbee se branchent nativement en USB, sans les soucis de passthrough du NAS.

### Installation

1. Télécharger **Raspberry Pi Imager**, choisir l'image officielle
   **Home Assistant OS** (image "Raspberry Pi 3"), flasher sur une carte SD (ou, mieux,
   une clé USB/SSD — plus fiable dans la durée que la SD pour l'écriture continue de la
   base recorder).
2. Démarrer le Pi, attendre ~10-20 min (première init), puis accéder à
   `http://homeassistant.local:8123`.
3. Créer le compte admin, définir nom du foyer et localisation.

### Configurer le RFXCOM (Somfy RTS)

1. Brancher le RFXtrx433E en USB sur le Pi.
2. **Paramètres > Appareils et services > Ajouter une intégration > RFXtrx** — Home
   Assistant détecte automatiquement le périphérique USB série.
3. Mettre chaque volet en mode association (bouton PROG existant sur le rail/moteur,
   comme pour apprendre une télécommande Somfy classique), puis dans HA :
   **Paramètres > Appareils > RFXtrx > Ajouter un appareil**, sélectionner "Somfy RTS" et
   suivre l'assistant d'appairage (il envoie une commande RTS que le volet apprend).
4. Chaque volet apparaît comme entité `cover.xxx`.

### Configurer le dongle Zigbee

Une fois la référence identifiée (voir plus haut) :

- **ZHA** (recommandé pour démarrer, intégré nativement) :
  **Paramètres > Appareils et services > Ajouter une intégration > ZHA**, sélectionner
  le port série du dongle.
- **Zigbee2MQTT** (si tu veux plus de contrôle/logs, ou support d'appareils exotiques) :
  s'installe comme add-on HAOS depuis le Add-on Store, nécessite aussi l'add-on
  **Mosquitto broker**.

### Fiabilité / bonnes pratiques

- Démarrer sur clé USB/SSD plutôt que carte SD si possible (l'écriture continue de
  l'historique use les cartes SD plus vite).
- Réduire la rétention du recorder si le stockage est limité (`recorder: purge_keep_days`
  dans `configuration.yaml`).
- Sauvegardes : Add-on **Backup** natif HAOS, à exporter régulièrement vers le NAS
  (ex: partage réseau monté, ou copie manuelle du fichier `.tar` généré).

---

## Prochaines étapes possibles

- Une fois un des deux chemins choisi, ajouter Zigbee2MQTT + Mosquitto si besoin de
  capteurs/prises Zigbee au-delà de ZHA.
- Automatisations de base : ouverture/fermeture des volets au lever/coucher du soleil.
