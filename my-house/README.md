# my-house

Configuration domotique personnelle : Home Assistant en Docker sur un NAS Synology,
avec intégration des volets roulants Somfy RTS (télécommande 433.42MHz).

## Contexte

- NAS : Synology (DSM 7+, Container Manager)
- Volets : Somfy RTS (télécommandes classiques, pas de box io-homecontrol)
- Ancienne config Jeedom abandonnée — on repart de zéro sur Home Assistant.

## 1. Déployer Home Assistant sur le Synology

### Pré-requis

1. Installer le package **Container Manager** depuis le Centre de paquets Synology (DSM 7+).
2. Activer SSH sur le NAS (Panneau de configuration > Terminal & SNMP) pour pouvoir lancer
   `docker compose` en ligne de commande — l'interface graphique de Container Manager ne
   propose pas toujours le mode réseau `host`, qui est fortement recommandé pour Home
   Assistant (découverte réseau, mDNS, intégrations qui scannent le LAN comme HomeKit ou
   les ampoules Wi-Fi).
3. Créer les dossiers de config sur le NAS :
   ```bash
   mkdir -p /volume1/docker/my-house/homeassistant
   mkdir -p /volume1/docker/my-house/esphome
   ```

### Lancer le stack

Copier `docker-compose.yml` sur le NAS (via File Station ou `scp`), puis en SSH :

```bash
cd /volume1/docker/my-house
docker compose up -d
```

Home Assistant est ensuite accessible sur `http://<ip-nas>:8123`, ESPHome sur
`http://<ip-nas>:6052`.

> Si le mode `host` pose problème sur ton modèle Synology (certains DSM/appliances le
> bloquent), passe en mode `bridge` classique en retirant `network_mode: host` et en
> ajoutant :
> ```yaml
>     ports:
>       - "8123:8123"
> ```
> Tu perdras juste la découverte automatique de certains appareils réseau (pas bloquant
> pour la suite de ce guide).

### Onboarding

Ouvrir `http://<ip-nas>:8123`, créer le compte admin, définir le nom du foyer et
l'emplacement (pour les automatisations liées au soleil/météo).

## 2. Volets Somfy RTS — pourquoi pas d'antenne branchée sur le NAS

Le protocole RTS (433.42MHz) est propriétaire Somfy et fonctionne en émission "one-way"
(pas d'accusé de réception). Brancher une antenne RF directement sur le NAS est
compliqué :

- Le NAS n'a pas de port RF, il faudrait passer par USB (ex: **RFXtrx433E**), et le
  passthrough USB vers un conteneur Docker sur Synology est capricieux (dépend du modèle,
  des droits, et Container Manager ne facilite pas le mapping `/dev/ttyUSB0`).

**Solution recommandée : un petit module ESP32 + émetteur CC1101, indépendant du NAS.**

- Coût : ~10-15€ (ESP32 dev board + module CC1101, ou une carte toute faite type
  "M5Stack Atom" + CC1101).
- Il se flashe avec **ESPHome** (déjà dans le `docker-compose.yml` ci-dessus), qui a un
  composant natif `remote_transmitter` + protocole Somfy RTS.
- Il tourne en Wi-Fi, se place à portée des volets (pas besoin d'être près du NAS), et
  remonte dans Home Assistant comme une entité `cover` classique dès qu'il est flashé.

### Étapes

1. Aller sur `http://<ip-nas>:6052` (interface ESPHome).
2. Créer un nouveau device ESP32, renseigner le Wi-Fi.
3. Ajouter la config Somfy RTS dans le YAML généré (exemple pour un volet) :
   ```yaml
   remote_transmitter:
     pin: GPIO4
     carrier_duty_percent: 100

   cover:
     - platform: somfy
       name: "Volet Salon"
       remote_transmitter_id: <id du remote_transmitter défini plus haut>
   ```
4. Flasher le module (USB depuis le PC la première fois, OTA ensuite).
5. Dans Home Assistant : **Paramètres > Appareils > Ajouter une intégration > ESPHome**,
   renseigner l'IP du module. Le volet apparaît automatiquement comme entité `cover`.
6. Programmer chaque volet en mode "association" via son bouton PROG existant (comme pour
   ajouter une télécommande Somfy classique) — l'ESP32 émule une télécommande RTS.

> Pour du multi-volets, un seul module ESP32 peut piloter plusieurs `cover:` (plusieurs
> `remote_transmitter` codes différents), pas besoin d'un module par volet.

## 3. Raspberry Pi — à considérer plus tard

Si tu remets un OS sur ta vieille Raspberry, elle peut servir de second point Zigbee/
Z-Wave (via un dongle USB comme un SkyConnect ou un Sonoff Zigbee 3.0) sans dépendre du
NAS, ou tourner Home Assistant OS complet si le NAS s'avère limitant. Pas nécessaire pour
démarrer : le stack Docker ci-dessus suffit pour Home Assistant + Somfy RTS.

## Prochaines étapes possibles

- Ajouter Zigbee2MQTT + Mosquitto si tu ajoutes des capteurs/prises Zigbee.
- Sauvegardes automatiques du dossier `homeassistant/` (déjà sur NAS, donc couvert par
  les snapshots Synology si configurés).
