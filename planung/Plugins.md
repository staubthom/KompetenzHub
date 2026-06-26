Plan: Plugin-Plattform für KompetenzHub
Zielbild
KompetenzHub soll langfristig ein offenes Plugin-Ökosystem unterstützen, in dem auch Drittanbieter Erweiterungen bereitstellen können. Diese Plugins sollen zentral auf der Instanz installiert, versioniert und signiert werden und danach pro Schule oder Tenant einzeln aktiviert oder deaktiviert werden können.

Die wichtigste Leitlinie ist dabei nicht nur Erweiterbarkeit, sondern kontrollierte Isolation. Ein Plugin darf den Kern der Software nicht direkt verändern, sondern nur über definierte Extension Points, ein formales Manifest, ein Capability-Modell und einen nachvollziehbaren Lifecycle arbeiten.

Saubere Deinstallation bedeutet in diesem Zielbild:

Keine aktiven Routen mehr
Keine sichtbaren UI-Beiträge mehr
Keine laufenden Jobs oder Webhooks mehr
Keine verbliebenen Secrets oder Storage-Artefakte mehr
Keine toten Referenzen im Kern
Daten entweder vollständig gelöscht oder bewusst archiviert, aber nie in einem undefinierten Zustand
Grundprinzipien
Plugins sind registrierte Erweiterungen, kein frei eingebetteter Code.
Installation und Aktivierung sind getrennte Schritte.
Jede Plugin-Ressource braucht einen klaren Besitzer.
Jedes Plugin arbeitet in eigenen Namespaces für API, Storage, Events und Datenbankobjekte.
Drittanbieter-Plugins müssen signiert und kompatibilitätsgeprüft sein.
Ein Plugin darf nur deklarierte Rechte und deklarierte Extension Points nutzen.
Ein Plugin-Uninstall gilt nur dann als erfolgreich, wenn eine vollständige Cleanup-Prüfung bestanden wurde.
Phasenplan
Phase 1: Sicherheitsgrenzen definieren
Festlegen, welche Arten von Plugins erlaubt sind, welche Kernbereiche unberührbar bleiben und welche APIs, UI-Slots, Datenzugriffe, Storage-Pfade und Netzwerkausgänge zulässig sind.

Phase 1: Manifest-Standard definieren
Ein Plugin darf nur dann installierbar sein, wenn es ein vollständiges Manifest mit Identität, Rechten, Beiträgen, Datenbankbedarf, Integrationen und Cleanup-Regeln enthält.

Phase 1: Vertrauensmodell aufbauen
Publisher-Identität, Signierung, Kompatibilitätsangaben, erlaubte Bezugsquellen und optionale Allow- oder Deny-Listen festlegen.

Phase 2: Backend-Registry entwerfen
Die heutige statische Modulverdrahtung in app.module.ts muss durch eine kontrollierte Plugin-Registry ergänzt werden.

Phase 2: Capability-System ergänzen
Die bestehenden Rollen und Guards in roles.guard.ts reichen nicht aus. Es braucht pluginfähige Berechtigungen wie plugin.pluginId.scope.

Phase 2: Ownership und Lifecycle einführen
Install, Enable, Disable, Upgrade und Uninstall müssen als explizite, auditierbare Betriebsschritte beschrieben und technisch abgebildet werden.

Phase 3: Datenmodell und Migrationen entkoppeln
Der heutige Prisma-Migrationspfad unter migrations ist für deinstallierbare Plugins nicht ausreichend. Plugin-Migrationen brauchen eine eigene Historie.

Phase 3: Frontend-Extension-Points definieren
Navigation, Admin-Seiten, Widgets und Modulerweiterungen müssen über registrierte Slots laufen statt über direkte Änderungen an AppShell.tsx.

Phase 4: Pilot-Plugin definieren
Zuerst ein bewusst begrenzter Plugin-Typ, bevor freie Drittanbieter-Plugins mit vollem Datenbankschema und externen Integrationen zugelassen werden.

Ziel-Manifest für Plugins
Das Manifest ist der formale Installationsvertrag zwischen Plugin und Plattform. Ohne vollständiges und gültiges Manifest darf ein Plugin weder installiert noch aktiviert werden.

Empfohlene Felder:

Feld	Zweck
schemaVersion	Version des Manifest-Formats
pluginId	Eindeutige technische Kennung, global stabil
displayName	Anzeigename des Plugins
version	Plugin-Version
publisher	Technischer und rechtlicher Herausgeber
signature	Signatur oder Verweis auf Signaturmaterial
description	Kurzbeschreibung
license	Lizenz des Plugins
support	Kontakt, Dokumentation, Support-URL
kompetenzHub	Minimale und maximale kompatible Kernversion
capabilities	Angeforderte Rechte, etwa UI-Slots, Storage, Webhooks, Jobs
dependencies	Abhängigkeiten zu Kernfunktionen oder anderen Plugins
routes	Deklarierte API- und UI-Routen
navigation	Gewünschte Navigationsbeiträge
adminPages	Beiträge für Admin-Oberflächen
widgets	Dashboard- oder Kontext-Widgets
database	Angabe, ob eigene Tabellen, Seeds oder Migrationen enthalten sind
storage	Verwendete Bucket- oder Prefix-Namensräume
integrations	Externe Systeme, Webhooks, Outbound-Ziele
backgroundJobs	Geplante Jobs, Trigger und Intervalle
secrets	Benötigte Geheimnisse oder Tokens
lifecycle	Install-, Upgrade-, Disable- und Uninstall-Hooks
cleanup	Deklaration aller Ressourcen, die beim Uninstall entfernt werden müssen
translations	Vorhandene Sprachpakete
audit	Welche Ereignisse das Plugin protokollieren muss
Zusätzliche Regeln:

Plugin-IDs müssen global eindeutig und unveränderlich sein.
Routen müssen pluginbezogen namespaciert sein.
Jedes angeforderte Capability muss explizit geprüft und freigegeben werden.
Cleanup darf nicht implizit sein, sondern muss deklarativ beschrieben werden.
Unsigned oder inkompatible Plugins dürfen nicht installierbar sein.
Ziel-Datenmodell für Installation, Aktivierung und Uninstall
Die Plattform sollte globale Installation und tenantbezogene Aktivierung sauber trennen.

Empfohlene Kernmodelle:

Modell	Zweck
PluginPackage	Technisches Paket im Dateisystem oder Artefakt-Store, inklusive Prüfsumme und Signaturstatus
PluginCatalogEntry	Registrierter Eintrag eines Plugins mit Metadaten, Publisher und Kompatibilität
PluginInstallation	Global auf der Instanz installierte Plugin-Version
PluginTenantActivation	Aktivierungsstatus eines Plugins pro Tenant
PluginSecret	Tenantbezogene oder globale Secrets für ein Plugin
PluginMigration	Historie ausgeführter Plugin-Migrationen
PluginResourceOwnership	Liste aller Ressourcen, die einem Plugin gehören
PluginEventLog	Audit- und Lifecycle-Ereignisse
PluginHealthState	Aktueller technischer Gesundheitszustand eines Plugins
PluginDependencyState	Erfüllung von Abhängigkeiten zu Kern oder anderen Plugins
Empfohlene Inhalte pro Modell:

Modell	Wichtige Felder
PluginInstallation	pluginId, installedVersion, packageHash, publisher, signatureStatus, installStatus, installedAt, installedBy
PluginTenantActivation	pluginId, tenantId, enabled, enabledVersion, configVersion, status, lastError, enabledAt, disabledAt
PluginSecret	pluginId, tenantId optional, key, secretRef, rotationState
PluginMigration	pluginId, version, migrationKey, executedAt, result, rollbackSupported
PluginResourceOwnership	pluginId, tenantId optional, resourceType, resourceKey, state, cleanupPolicy
PluginEventLog	pluginId, tenantId optional, eventType, severity, payloadRef, createdAt
PluginHealthState	pluginId, tenantId optional, state, lastCheckAt, message
PluginDependencyState	pluginId, dependencyType, dependencyKey, satisfied, checkedAt
Datenregeln:

Ein Plugin darf nur eigene Tabellen verwalten.
Eigene Tabellen müssen geprefixt und tenant-scoped sein.
Beziehungen in Kernmodelle müssen bewusst erlaubt sein.
Plugin-Daten dürfen nie unkontrolliert in freie JSON-Felder diffundieren.
Konfiguration und Aktivierung müssen versioniert sein.
Jede Ressource muss rückverfolgbar einem Plugin gehören.
Install, Enable, Disable, Upgrade, Uninstall
Install:

Paket laden
Signatur prüfen
Manifest validieren
Kompatibilität mit Kernversion prüfen
Konflikte mit Routen, Slots, Jobs und Namespaces prüfen
Abhängigkeiten prüfen
Plugin global registrieren
Migrationen ausführen, falls zulässig
Ownership-Liste initialisieren
Installationsstatus protokollieren
Enable:

Tenant-Konfiguration validieren
Secrets und Integrationen prüfen
Tenant-Aktivierung setzen
UI-Beiträge und API-Endpunkte freischalten
Jobs und Webhooks tenantbezogen aktivieren
Aktivierung protokollieren
Disable:

UI-Beiträge ausblenden
API-Zugriffe sperren
Jobs, Scheduler und Webhooks stoppen
Integrationen pausieren
Konfiguration und Daten unangetastet lassen
Status protokollieren
Upgrade:

Neue Version prüfen
Breaking-Change-Regeln auswerten
Migrationspfad validieren
Upgrade ausführen
Tenant-Aktivierungen neu validieren
Fehlerfall sauber zurückrollen
Upgrade protokollieren
Uninstall:

Vorbedingung prüfen: Plugin ist für keinen Tenant mehr aktiv
Cleanup-Plan aus Manifest und Ownership-Liste laden
Jobs, Webhooks, Integrationen und Secrets entfernen
Storage-Artefakte entfernen
Plugin-Konfiguration entfernen
Plugin-Daten löschen oder archivieren, je nach Policy
Plugin-Metadaten deregistrieren
Erfolg nur dann markieren, wenn keine aktive Ressource mehr verbleibt
Uninstall-Definition ohne Spuren
Sauber deinstalliert bedeutet:

Bereich	Erwartung
UI	Keine Navigation, keine Widgets, keine Admin-Seiten mehr
API	Keine aktiven Routen oder Hook-Registrierungen mehr
Jobs	Keine laufenden Jobs, Trigger, Scheduler oder Worker mehr
Webhooks	Keine aktiven Endpunkte, Abonnements oder Retry-Warteschlangen mehr
Secrets	Keine aktiven Secrets oder Tokens mehr
Storage	Keine verbleibenden Objekte im Plugin-Namespace mehr
Daten	Entweder vollständig gelöscht oder bewusst archiviert
Audit	Uninstall protokolliert, aber ohne betriebliche Nebenwirkungen
Kern	Keine defekten Referenzen oder Konflikte mit späteren Neuinstallationen
Wichtige Klarstellung:
Vollständig spurlose Deinstallation im Sinne von keinerlei Historie ist nicht sinnvoll. Audit-Einträge über Installation, Aktivierung und Entfernung sollten erhalten bleiben. Spurlos bedeutet hier: keine aktive technische oder fachliche Rückwirkung im laufenden System.

Empfohlene Plugin-Ordnerstruktur für dieses Monorepo
Empfohlenes Zielbild:

Pfad	Zweck
Plugins.md	Architektur- und Betriebsdokumentation
plugins/registry	Zentrale Plugin-Registry, Validatoren, Loader, Signaturprüfung
plugins/sdk	Öffentliches SDK für Plugin-Autoren
plugins/contracts	Gemeinsame Typen für Manifest, Capabilities, Lifecycle und Slots
plugins/templates	Vorlagen für neue Plugins
plugins/packages	Lokale Plugin-Pakete während Entwicklung oder kuratierte First-Party-Plugins
plugins/packages/plugin-id	Einzelnes Plugin-Paket
plugins/packages/plugin-id/manifest	Manifest-Datei des Plugins
plugins/packages/plugin-id/server	Backend-Teil des Plugins
plugins/packages/plugin-id/web	Frontend-Beiträge des Plugins
plugins/packages/plugin-id/migrations	Plugin-spezifische Migrationen
plugins/packages/plugin-id/translations	Sprachdateien
plugins/packages/plugin-id/assets	Statische Assets
plugins/packages/plugin-id/tests	Contract-, Lifecycle- und Cleanup-Tests
Strukturprinzipien:

Kern und Plugins bleiben physisch getrennt.
SDK und Verträge liegen getrennt von einzelnen Plugins.
Migrationen eines Plugins liegen immer beim Plugin selbst.
Frontend- und Backend-Beiträge eines Plugins liegen zusammen.
Jedes Plugin bringt seine eigenen Tests, Übersetzungen und Cleanup-Definitionen mit.
Empfohlene zukünftige Kern-Erweiterungen
Backend:

PluginRegistryService
PluginManifestValidator
PluginLifecycleService
PluginPermissionResolver
PluginMigrationService
PluginOwnershipService
PluginHealthService
Frontend:

PluginNavRegistry
PluginAdminPageRegistry
PluginWidgetRegistry
PluginTranslationLoader
PluginSettingsClient
Nicht-Ziele in der ersten Ausbaustufe
Keine vollständige freie Codeausführung ohne Signierung
Keine direkten Änderungen am Kernschema durch Plugins ohne Regeln
Keine globalen CSS-Overrides durch Plugins
Keine direkten Eingriffe in die AppShell
Keine beliebigen Outbound-Netzwerkzugriffe ohne Deklaration
Keine stillen Hintergrundjobs ohne Registry und Ownership
Keine Deinstallation ohne Cleanup-Nachweis
Empfohlene erste Pilotstufe
Als erste Ausbaustufe würde ich noch nicht sofort freie Drittanbieter-Plugins mit vollen Datenbankmigrationen erlauben. Robuster wäre:

Zuerst Manifest, Registry, Signaturprüfung und Tenant-Aktivierung bauen
Dann Plugins mit UI-Beiträgen, Admin-Seiten und klar begrenzten Backend-Endpunkten zulassen
Danach erst eigene Migrationen, Jobs und Integrationen freischalten
Erst ganz am Schluss ein wirklich offenes Drittanbieter-Modell mit tieferer Ausführung prüfen