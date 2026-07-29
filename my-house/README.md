# my-house

Configuration domotique personnelle : Home Assistant, en remplacement de l'ancienne
config Jeedom (abandonnée). Deux options de déploiement documentées en parallèle :

- **[nas.md](./nas.md)** — NAS Synology (Docker) : mutualisé avec le reste de l'infra
  (`mottaret-watch`, `prono-core`), mais le passthrough USB vers un conteneur est
  capricieux sur Synology.
- **[raspberry.md](./raspberry.md)** — Raspberry Pi 3 B+ en direct (Home Assistant OS) :
  machine dédiée comme l'était Jeedom, matériel USB branché nativement sans souci de
  passthrough.

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

## Prochaines étapes possibles

- Une fois un des deux chemins choisi, ajouter Zigbee2MQTT + Mosquitto si besoin de
  capteurs/prises Zigbee au-delà de ZHA.
- Automatisations de base : ouverture/fermeture des volets au lever/coucher du soleil.
