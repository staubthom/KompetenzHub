#!/bin/bash

# Pfad zu deinem Projektordner (UNBEDINGT ANPASSEN!)
PROJEKT_PFAD="/root/KompetenzHub"

cd "$PROJEKT_PFAD" || exit

# 1. Laufende Container stoppen
docker compose  -f docker-compose_dev.yaml --profile app down

# 2. Den manipulierten Datenordner löschen
rm -rf ./data

# 3. Das saubere Ur-Backup frisch kopieren
cp -r ./data_backup ./data

# 4. App wieder frisch starten
docker compose  -f docker-compose_dev.yaml --profile app up -d