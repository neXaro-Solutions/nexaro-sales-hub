# Betrieb

## Zugang

Das vorhandene aktive Administratorkonto ist freigeschaltet. Keine neuen Nutzer, kein öffentliches Signup, keine erfundenen Passwörter. Anmeldung am Hub mit dem bestehenden Konto. Ein vergessenes Passwort über den bestehenden Supabase-Administrationsprozess zurücksetzen. Eine MFA-Erweiterung kann später ergänzt werden; die aktuelle App implementiert keine eigene MFA-Oberfläche.

## Veröffentlichung

1. `npm ci --ignore-scripts && npm run check`.
2. `npx playwright install --with-deps chromium && npm run test:e2e`.
3. Inhalt von `dist/` statisch veröffentlichen. Relative Asset-Pfade unterstützen einen Unterordner `/hub/`.
4. Bei eigenem Pages-Auftritt im neuen Repository unter Settings → Pages → Source „GitHub Actions“ aktivieren und den optionalen Pages-Workflow ausführen. Die GitHub-Verbindung kann diese administrative Einstellung nicht selbst setzen.
5. Bestehende feste Formularadresse: die drei `public-lead`/`nx-public-intake`-Dateien aus `public/` ins Stammverzeichnis des alten Pages-Repositories übernehmen. Service Worker für diese Formularroute auf Netzwerkzugriff umstellen; alte Caches dürfen die Umstellung nicht dauerhaft blockieren.

Keine Quellcode-Neuveröffentlichung ist erforderlich, um den heutigen Hub zu benutzen, wenn der geprüfte Build im bestehenden Pages-Auftritt unter `/hub/` veröffentlicht ist. Der Quellcode bleibt im neuen Repository. Folgeversionen benötigen eine erneute Übernahme des geprüften Builds; ein automatischer Cross-Repository-Deploy erfordert gesonderte GitHub-Schreibberechtigungen und wurde nicht mit einem öffentlich eingebetteten Token improvisiert.

## Datenbankschema

Die Migration unter `supabase/migrations` ist auf dem vorhandenen Projekt angewendet. Neue Funktionen verwenden RLS und erlauben den öffentlichen Eingang nur über eine servicegeschützte Transaktion. Die produktiven alten Tabellen sind davon unabhängig.

Bei einer neuen Umgebung: vorhandene `staff_users`-Tabelle mit genau einem aktiven Administrator erforderlich oder den Seed-Abschnitt durch eine explizite, verifizierte Owner-Zuweisung ersetzen. SQL-Migration zuerst in einer Testumgebung prüfen. Keine Produktions-Tabellen zurücksetzen, um einen Fehler zu beseitigen.

## Formular / Edge Function

`nx-public-intake` ist öffentlich erreichbar und validiert selbst eine HMAC-Challenge. `verify_jwt=false` ist ausschließlich für dieses öffentliche Kontaktformular beabsichtigt. Servergeheimnisse stammen aus den automatisch bereitgestellten Supabase-Umgebungsvariablen; niemals ins Browser-JavaScript kopieren.

Erwartete Origin: `https://nexaro-solutions.github.io` (auch Firmen-Domain konfiguriert). Lokale Tests des Formulars sollten die Requests mocken oder unter der tatsächlichen Pages-Origin erfolgen. Kein produktiver Test mit echten personenbezogenen Daten. Testanfragen eindeutig kennzeichnen und gezielt entfernen.

Logs enthalten keine bewusst ausgegebenen Payloads. Edge-Provider können technische Requests/IPs separat protokollieren. Datenschutz-/Impressumsangaben vor Weiterverwendung bei geänderten Betriebsbedingungen aktualisieren.

## Backups und Wiederherstellung

Die Anwendung hat JSON-Export. Ob automatische Datenbank-Backups/PITR verfügbar sind, hängt vom vorhandenen Supabase-Tarif ab; das wurde nicht als garantiert eingerichtet.

- Vor umfangreichen Importen exportieren. Exporte enthalten Kundendaten und Einkaufspreise und gehören in geschützte Aufbewahrung, niemals ins öffentliche GitHub.
- Regelmäßige Datenbank-Sicherung im Supabase-Dashboard prüfen und aktivieren, falls im bestehenden Tarif möglich. Kein kostenpflichtiges Upgrade wurde ausgeführt.
- Eine Wiederherstellung zuerst in einer isolierten Testdatenbank prüfen, einschließlich Owner/RLS und Datensatzanzahlen.
- JSON enthält Version, Zeitstempel und Tabellen. Reihenfolge für kontrollierten Wiederimport: Kunden/Lieferanten → Chancen/Produkte → Aufgaben/Angebote/Routen/Ereignisse. Trigger und Angebotsnummern beachten; nicht unkontrolliert in produktive Tabellen importieren.
- Es gibt in dieser Version keinen ungesicherten „alles überschreiben“-Knopf. Datenbank-Restore und JSON-Reimport benötigen einen geprüften administrativen Ablauf.

## Störungen

- Keine Verbindung: Formular geöffnet lassen, Eingaben prüfen, wiederholen. Keine stille lokale Ersatzspeicherung von Kundendaten.
- Versionskonflikt: Daten neu laden, Änderungen vergleichen, erneut speichern.
- Öffentliche Kartenrecherche ausgelastet: vorhandene Kunden und Google-Maps-Links weiter nutzen. Keine ungebremsten automatischen Wiederholungen.
- Ungültiger Import: keine Teilübernahme. Spaltenmapping und Preise prüfen, CSV erneut einlesen.
- Formularantwort unklar: denselben Versand wiederholen; Challenge-ID verhindert einen doppelten Kunden bei angenommenem Erstversand.

## Noch nicht automatisiert

Großhandelsportal ohne bekannte Adresse/Exportmöglichkeit, verbindliche SumUp-Preisaktualisierung, externe Rechnungsstellung, E-Mail-Versand, Verkehrs-/Öffnungszeitenoptimierung und überwachte Backup-Wiederherstellung. Das sind explizite Integrationsgrenzen, keine versteckten Demo-Funktionen.

### Ortssuche zur Laufzeit abschalten oder wechseln

`maps-config.json` im veröffentlichten Build ist eine separat geladene Betriebskonfiguration. `enabled: false` beendet externe Ortssuchen ohne neue Softwareversion. `geocoder` kann auf einen kompatiblen Dienst umgestellt werden; die CSP muss dessen Host erlauben (eigene Origin und der vorhandene Supabase-Host sind bereits erlaubt). Nominatim-Nutzungsregeln und attribution müssen eingehalten werden. Keine privaten Startadressen werden zur Routensortierung an Nominatim übertragen.
