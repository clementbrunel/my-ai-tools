# Option A — Home Assistant en Docker sur le NAS Synology

Mutualisé avec le reste de l'infra (`mottaret-watch`, `prono-core`), mais le passthrough
USB vers un conteneur est capricieux sur Synology. Voir le matériel existant (RFXCOM,
dongle Zigbee) dans le [README](./README.md).

## Pré-requis

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

## Lancer le stack

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

## Brancher le RFXCOM et le dongle Zigbee sur le NAS (passthrough USB)

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
préférer l'option [Raspberry Pi](./raspberry.md) avec ces deux périphériques.

## Alternative sans passthrough : ESPHome pour le RTS uniquement

Si le passthrough du RFXCOM vers le NAS ne fonctionne pas de façon fiable, il reste
possible de piloter les volets sans lui via un petit module ESP32 + CC1101 flashé avec
ESPHome (déjà inclus dans le `docker-compose.yml`), indépendant du NAS. Le principe
ESPHome est identique à celui décrit pour le RTS dans le guide [Raspberry Pi](./raspberry.md),
seule la question du passthrough change.
