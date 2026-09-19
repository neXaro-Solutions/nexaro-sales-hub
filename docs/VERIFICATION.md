# Prüfprotokoll · 19.09.2026

## Ausgeführt

- `npm run check`: 15 Unit-Tests bestanden, TypeScript-Prüfung und Produktionsbuild erfolgreich. Geprüft sind Gebühren/Kartenmix, Margen, CSV-Validierung, Routenteilung und Validierung öffentlicher Anfragen.
- Playwright: acht Tests bestanden (vier Abläufe auf Desktop und Mobilgerät). Kunden mit beiden Bereichen anlegen, Analyse/Angebot speichern, Druckansicht ohne EK, Tagesroute, Lieferantenimport/Produktvergleich, geschützte Startseite und Formularfehler mit identischem Wiederholungsversand. Demo schreibt nicht ins Backend.
- Browserprüfung des gebauten Dashboards und öffentlichen Formulars bei 1440 bzw. 390 Pixeln Breite. Keine horizontale Überbreite in den getesteten CRM-Abläufen.
- `npm audit --omit=dev`: keine bekannten Schwachstellen der Produktionsabhängigkeiten zum Prüfzeitpunkt.
- Migration im bestehenden Supabase-Projekt angewendet. Neue Tabellen haben RLS. Ein Owner ist freigeschaltet; anonyme Nutzer haben keine Leserechte auf CRM-Tabellen, andere angemeldete Nutzer weder Lese- noch Schreibrechte.
- SQL-Transaktion mit Owner-Rolle: Kunde mit beiden Geschäftsbereichen, verknüpfte Verkaufschancen, Angebotsprüfung und Versionszähler erfolgreich. Gegenprobe mit fremder Nutzer-ID abgewiesen. Teständerungen zurückgerollt.
- Öffentliche Edge Function aktiv. Eine eindeutig markierte Testanfrage zweimal mit derselben signierten Challenge versandt: beide Antworten erfolgreich, genau ein Kunde, zwei Verkaufschancen und zwei Wiedervorlagen gespeichert. Testdaten gezielt entfernt.

## GitHub

- [GitHub-Checks](https://github.com/neXaro-Solutions/nexaro-sales-hub/actions/runs/35440587311): erfolgreich, einschließlich der acht Tests mit regulärem Playwright-Chromium. Geprüfter Quellcode-Commit: `63b941d30aeff7cdecc0f878b98cde753bf01890`.
- [Pages-Veröffentlichung](https://github.com/neXaro-Solutions/new-nexaro-field-sales-crm/actions/runs/35440607723): erfolgreich. Deployment-Commit: `a20736f5c031ea4c40ceb86e30003f747ab01d0c`.

## Live-Abruf

Hub-Startseite, feste Formularadresse, Formular-JavaScript und Kartenkonfiguration antworteten nach Veröffentlichung mit HTTP 200 und stimmten per SHA-256 mit dem lokalen Build überein. Loginseite und Demo-Dashboard wurden im mobilen Browser von der Live-Adresse geladen. Der öffentliche Endpoint lieferte bei separatem HTTPS-Abruf eine signierte Challenge und den passenden CORS-Header für die Pages-Origin.

Auch das Formular wurde abschließend unter der exakten Live-Adresse im mobilen Browser geladen: signierte Challenge empfangen, keine JavaScript-Fehler und keine horizontale Überbreite. Der Container-Browser benötigte die Proxy-Konfiguration mit HTTP/1.1; dies ändert keine Produktionseinstellungen. Es wurde bei dieser Prüfung keine weitere Kundenanfrage abgeschickt.

Die Formular-Wartezeit wurde nach einem langsamen Live-Verbindungsaufbau auf 20 Sekunden für die Challenge und 25 Sekunden für den Versand erhöht. Fehler werden weiterhin angezeigt; Wiederholungen behalten die Anfrage-ID.

## Aussagegrenzen

Dies ist kein unabhängiger Penetrationstest oder Verfügbarkeitsnachweis. Die echte Anmeldung im Browser mit dem Passwort des Inhabers wurde nicht ausgeführt; Passwort und Sitzung wurden nicht übernommen. Die Berechtigungen wurden auf Datenbankebene geprüft.

Der lokale Chromium-Test nutzte eine containergeeignete Chromium-Binärdatei. Der GitHub-Workflow installiert den regulären Playwright-Browser. Die Buildhinweise betreffen die Größe des JavaScript-Bundles und `use client`-Direktiven der Icon-Bibliothek; der statische SPA-Build ist erfolgreich.

Vorhandene Sicherheitswarnungen des älteren CRM und der Auth-Konfiguration sind in ARCHITECTURE.md dokumentiert. Backup-Wiederherstellung, Großhandelsanbindung und automatische Preisaktualisierung sind nicht als fertig getestet ausgewiesen. Öffentliche Kartenanbieter werden nicht durch automatisierte Tests belastet.
