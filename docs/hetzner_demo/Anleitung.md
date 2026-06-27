# Hetzner Demo Anleitung

## 1. Docker vorbereiten

```sh
# GPG-Key für die Sicherheit hinzufügen
sudo apt-get update
snap install docker

sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

## 2. Docker-Repository hinzufügen

```sh
# Repository zu den Apt-Quellen hinzufügen
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null


sudo apt-get update
sudo apt-get install docker-compose-plugin -y
```

## 3. Verzeichnisstruktur anlegen

Erstelle die Ordnerstruktur manuell, damit Docker keine Root-Rechte darauf setzt:

```sh
mkdir -p data/postgres data/redis data/minio
```

## 4. Anwendung starten

```sh
docker compose -f docker-compose_dev.yaml --profile  app up -d  --force-recreate
```

## 5. Anwendung initial einrichten

Alles einrichten in der App

## 6. Anwendung stoppen

```sh
docker compose -f docker-compose_dev.yaml --profile  app down
```

## 7. Daten sichern

```sh
cp -r ./data ./data_backup
```

## 8. Reset-Skript vorbereiten

```sh
nano reset_demo.sh
Kopiere den Inhalt der Datei hinein.
chmod +x reset_demo.sh
```

## 9. Cronjob einrichten

```sh
crontab -e
0 * * * * /root/KompetenzHub/reset_demo.sh > /dev/null 2>&1
```
