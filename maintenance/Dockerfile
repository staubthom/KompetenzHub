FROM nginx:alpine
# Kopiere die Wartungsseite in das Standardverzeichnis von Nginx (läuft intern auf Port 80)
COPY maintenance/index.html /usr/share/nginx/html/index.html
COPY maintenance/wartung.png /usr/share/nginx/html/wartung.png