# 12 – Nicht-funktionale Anforderungen (NFR)

## 1. Datenschutz (CH-DSG / DSGVO-nah)

| ID      | Anforderung                                                                   |
| ------- | ----------------------------------------------------------------------------- |
| NFR-DS1 | Personenbezogene Daten (Lernende, Bewertungen) nur zweckgebunden verarbeiten. |
| NFR-DS2 | Datensparsamkeit; an KI nur notwendige Inhalte, PII möglichst entfernen.      |
| NFR-DS3 | Recht auf Auskunft/Löschung umsetzbar (Export/Delete je Person).              |
| NFR-DS4 | Speicherort konfigurierbar (CH/EU-Hosting bevorzugt).                         |
| NFR-DS5 | KI-Nutzung transparent & opt-in; lernort-eigene Endpoints möglich.            |
| NFR-DS6 | Aufbewahrung von Klassen-Archiven gemäss Schul-Vorgaben (verschlüsselt).      |
| NFR-DS7 | Auftragsverarbeitungsverträge (AVV) mit KI-/Cloud-Providern.                  |

## 2. Sicherheit

| ID      | Anforderung                                                                 |
| ------- | --------------------------------------------------------------------------- |
| NFR-SE1 | TLS überall, HSTS, sichere Cookies.                                         |
| NFR-SE2 | RBAC + Tenant-Isolation strikt durchgesetzt.                                |
| NFR-SE3 | Secrets verschlüsselt (KI-Tokens at rest).                                  |
| NFR-SE4 | Input-Validierung, Schutz vor XSS/SQLi/SSRF (v.a. KI-baseUrl).              |
| NFR-SE5 | Rate Limiting (Login, Join-Code, KI).                                       |
| NFR-SE6 | Audit-Logging sicherheitsrelevanter Aktionen.                               |
| NFR-SE7 | Datei-Uploads: Typ-/Grössenprüfung, Virenscan (optional), keine Ausführung. |
| NFR-SE8 | Regelmässige Backups (DB + S3), getestete Wiederherstellung.                |

## 3. Performance & Skalierbarkeit

| ID      | Anforderung                                                          |
| ------- | -------------------------------------------------------------------- |
| NFR-PE1 | Seitenladezeit < 2 s (P95) bei normalem Datenvolumen.                |
| NFR-PE2 | Dashboard-Aggregation für 30 Lernende × Matrix performant (Caching). |
| NFR-PE3 | Asynchrone KI-/Export-Jobs (kein Blocking der UI).                   |
| NFR-PE4 | Horizontale Skalierung von API & Worker.                             |
| NFR-PE5 | Direkter S3-Upload (presigned) entlastet API.                        |

## 4. Verfügbarkeit & Betrieb

| ID      | Anforderung                                                              |
| ------- | ------------------------------------------------------------------------ |
| NFR-AV1 | Ziel-Verfügbarkeit ≥ 99.5% (Schulbetriebszeiten).                        |
| NFR-AV2 | Health-Checks, Monitoring, Alerting.                                     |
| NFR-AV3 | Graceful Degradation bei KI-Ausfall (manuelle Bewertung weiter möglich). |
| NFR-AV4 | Zero-Downtime-Deployments (Migrationsstrategie).                         |

## 5. Internationalisierung

| ID        | Anforderung                                                     |
| --------- | --------------------------------------------------------------- |
| NFR-I18N1 | UI in DE/FR/IT/EN; Lernende:r-Sprache aus Profil.               |
| NFR-I18N2 | Fachliche Inhalte mehrsprachig (i18n-Felder, 4 Sprachen).       |
| NFR-I18N3 | Datums-/Zahlenformate lokalisiert (CH).                         |
| NFR-I18N4 | Fallback-Sprache definierbar (z.B. DE), wenn Übersetzung fehlt. |

## 6. Wartbarkeit & Qualität

| ID      | Anforderung                                                   |
| ------- | ------------------------------------------------------------- |
| NFR-WA1 | TypeScript End-to-End, geteilte Typen (DTO/Schema).           |
| NFR-WA2 | Automatisierte Tests (Unit, Integration, E2E), Coverage-Ziel. |
| NFR-WA3 | CI/CD mit Lint, Test, Build, Migrate.                         |
| NFR-WA4 | OpenAPI-Doku automatisch generiert.                           |
| NFR-WA5 | Strukturierte Logs, Correlation-IDs.                          |

## 7. Barrierefreiheit & Usability

| ID      | Anforderung                                      |
| ------- | ------------------------------------------------ |
| NFR-UX1 | WCAG 2.1 AA.                                     |
| NFR-UX2 | Responsive/Mobile für Lernende.                  |
| NFR-UX3 | Verständliche Fehlermeldungen, Undo wo sinnvoll. |

## 8. Portabilität & Deployment

| ID      | Anforderung                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------- |
| NFR-PO1 | Alle Komponenten (Web, API, Worker) als **Docker-Images** baubar (Multi-Stage, schlank).          |
| NFR-PO2 | Lokaler Betrieb via **Docker Compose** (Web, API, Worker, Postgres, Redis, MinIO).                |
| NFR-PO3 | Produktiver Betrieb auf **Kubernetes** (Helm-Chart/Kustomize, Deployments, Services, Ingress).    |
| NFR-PO4 | Zustandslose Container; Konfiguration ausschliesslich über **Env-Variablen/Secrets** (12-Factor). |
| NFR-PO5 | Liveness-/Readiness-Probes; horizontale Skalierung (HPA) für API & Worker.                        |
| NFR-PO6 | Persistenz extern (Managed Postgres, S3/Objektspeicher) – keine lokalen Volumes für Daten.        |
| NFR-PO7 | DB-Migrationen als Init-/Job-Container vor Rollout.                                               |
| NFR-PO8 | Images versioniert/getaggt; OCI-konform; optional Image-Signing/Scanning.                         |
