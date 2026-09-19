# Prüfprotokoll · 19.09.2026

## Ausgeführt

- `npm run check`: 15 Unit-Tests bestanden, TypeScript-Prüfung und Produktionsbuild erfolgreich. Geprüft sind Gebühren/Kartenmix, Margen, CSV-Validierung, Routenteilung und Validierung öffentlicher Anfragen.
- Playwright: acht Tests bestanden (vier Abläufe auf Desktop und Mobilgerät). Kunden mit beiden Bereichen anlegen, Analyse/Angebot speichern, Druckansicht ohne EK, Tagesroute, Lieferantenimport/Produktvergleich, geschützte Startseite und Formularfehler mit identischem Wiederholungsversand. Demo schreibt nicht ins Backend.
- Browserprüfung des gebauten Dashboards und öffentlichen Formulars bei 1440 bzw. 390 Pixeln Breite. Keine horizontale Überbreite in den getesteten CRM-Abläufen.
- `npm audit --omit=dev`: keine bekannten Schwachstellen der Produktionsabhängigkeiten zum Prüfzeitpunkt.
- Migration im bestehenden Supabase-Projekt angewendet. Neue Tabellen haben RLS. Ein Owner ist freigeschaltet; anonyme Nutzer haben keine Leserechte auf CRM-Tabellen, andere angemeldete Nutzer weder Lese- noch Schreibrechte.
- SQL-Transaktion mit Owner-Rolle: Kunde mit beiden Geschäftsbereichen, verknüpfte Verkaufschancen, Angebotsprüfung und Versionszähler erfolgreich. Gegenprobe mit fremder Nutzer-ID abgewiesen. Teständerungen zurückgerollt.
- Öffentliche Edge Function aktiv. Eine eindeutig markierte Testanfrage zweimal mit derselben signierten Challenge versandt: beide Antworten erfolgreich, genau ein Kunde, zwei Verkaufschancen und zwei Wiedervorlagen gespeichert. Testdaten gezielt entfernt.

## Aussagegrenzen

Dies ist kein unabhängiger Penetrationstest oder Verfügbarkeitsnachweis. Die echte Anmeldung im Browser mit dem Passwort des Inhabers wurde nicht ausgeführt; Passwort und Sitzung wurden nicht übernommen. Die Berechtigungen wurden auf Datenbankebene geprüft.

Der lokale Chromium-Test nutzte eine containergeeignete Chromium-Binärdatei. Der GitHub-Workflow installiert den regulären Playwright-Browser. Die Buildhinweise betreffen die Größe des JavaScript-Bundles und `use client`-Direktiven der Icon-Bibliothek; der statische SPA-Build ist erfolgreich.

Vorhandene Sicherheitswarnungen des älteren CRM und der Auth-Konfiguration sind in ARCHITECTURE.md dokumentiert. Backup-Wiederherstellung, Großhandelsanbindung und automatische Preisaktualisierung sind nicht als fertig getestet ausgewiesen. Öffentliche Kartenanbieter werden nicht durch automatisierte Tests belastet.
