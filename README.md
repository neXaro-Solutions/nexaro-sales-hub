# neXaro Sales Hub

Ein zentraler, geschützter Arbeitsbereich für einen Inhaber: **SumUp Vertrieb** und **neutrale Händlerverwaltung**. Schwarz, Orange und Weiß orientieren sich am neXaro-Flyer.

## Funktionen

- Zentrale Kundenakte, getrennte Verkaufschancen, Gesprächshistorie, Aufgaben und Dashboard.
- SumUp-Kostenvergleich mit lokaler Foto-Texterkennung, Belegprüfung, Kartenmix und Online-Zahlungen. Bedarfsabhängiger Hardwarevorschlag sowie Monats-/optionaler Jahresabo-Vergleich; Leitfaden und Angebot.
- Neutrale Händlerkontakte, Gesprächsnotizen, Termine und Wiedervorlagen mit deutscher Ortszeit, zentrale Kundenhistorie.
- Private Dokumentenablage je Kunde: PDF, JPG, PNG, WebP und TXT bis 10 MB. Kein öffentlicher Dateilink; keine produktbezogene Katalog-/Angebotsfunktion in dieser Ansicht. Bestehende Altdaten werden nicht gelöscht.
- Öffentliche OSM-Recherche, Google Maps / Street View, manuelle Tagesrouten und Sortierung nach Luftlinie. Navigation in mobilen Etappen ohne verlorene Zwischenstopps.
- Angebotsnummern, Kunden-/Berechnungssnapshots, serverseitige Gesamtsummen, Druck-/PDF-Ansicht ohne Einkaufspreise.
- Öffentliches Kontaktformular: geprüfte Eingaben → Kunde → passende Verkaufschancen → Wiedervorlagen. Doppelte Übermittlung derselben Anfrage wird nur einmal verarbeitet.
- Persönlicher Login, Datenbankberechtigungen für genau einen freigeschalteten Nutzer, Versionsprüfung gegen versehentliches Überschreiben.
- JSON-Export, Fehlermeldungen, Online-Status, automatisierte Berechnungs- und Browsertests.

## Direkt öffnen

- [Sales Hub · Anmeldung](https://nexaro-solutions.github.io/new-nexaro-field-sales-crm/hub/)
- [Demo mit fiktiven Daten](https://nexaro-solutions.github.io/new-nexaro-field-sales-crm/hub/?demo=1)
- [Öffentliches Kontaktformular](https://nexaro-solutions.github.io/new-nexaro-field-sales-crm/public-lead.html)

## Start

Node.js 24, dann:

```sh
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1
npm run test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

`?demo=1` öffnet eine klar markierte Demo mit fiktiven Daten ausschließlich im Arbeitsspeicher. Es gibt keine Demo-Schreibzugriffe auf Supabase.

Produktiv verwendet die App das vorhandene Supabase-Projekt. Die öffentliche Projektadresse und der Publishable Key sind keine Geheimnisse; private Daten schützt RLS. **Keine Service-Role-Schlüssel in Frontend, `.env` mit `VITE_` oder GitHub eintragen.**

## Datenbank / Betrieb

Zur Fotoanalyse siehe [Bedienung und Grenzen](docs/STATEMENT-OCR.md).

Zur Händlerverwaltung und aktuellen Systemprüfung siehe [Prüfung vom 20.09.2026](docs/SYSTEM-CHECK-2026-09-20.md).

Siehe [Betriebsleitfaden](docs/OPERATIONS.md), [Architektur und Sicherheit](docs/ARCHITECTURE.md), [Prüfprotokoll](docs/VERIFICATION.md) und [öffentliche Quellen](docs/SOURCES.md).

Die neue Datenstruktur verwendet ausschließlich `nx_*`-Tabellen. Alte Kunden werden nicht übernommen. Das bestehende Administratorkonto wird aus dem bereits angelegten aktiven `staff_users`-Administrator übernommen, sofern genau einer existiert. Andere Auth-Konten bekommen keinen CRM-Zugriff.

## Bereitstellung

Der Quellcode liegt in `neXaro-Solutions/nexaro-sales-hub`. Der geprüfte statische Build ist unter `/hub/` im bestehenden Pages-Repository `new-nexaro-field-sales-crm` veröffentlicht. Dadurch bleiben die bereits aktive Hosting-Konfiguration und die feste Formularadresse nutzbar.

Die Kontaktformular-Adresse bleibt:

**https://nexaro-solutions.github.io/new-nexaro-field-sales-crm/public-lead.html**

Die Dateien `public/public-lead.html`, `public/nx-public-intake.js` und `public/nx-public-intake.css` gehören dazu ins Stammverzeichnis des bisherigen Repositories. Der öffentliche Empfang wird über `supabase/functions/nx-public-intake` bereitgestellt.

## Klare Grenzen

- Kein Zugriff auf tatsächliche SumUp-Transaktionen; Analysen verwenden geprüfte Belegwerte oder eingegebene Händlerzahlen und öffentliche Referenzkonditionen vom 19.09.2026.
- SumUp-Preise werden nicht unkontrolliert aus Website-HTML überschrieben. Vor Angeboten aktuellen Quellenstand prüfen.
- Kein Großhandels-API-Zugang vorhanden. Der Dateiimport funktioniert; eine konkrete Portalautomatisierung benötigt den Namen und die Portaladresse des Händlers sowie eine Prüfung seiner Möglichkeiten.
- Öffentliche Kartendienste bieten keine garantierte Verfügbarkeit; keine kostenpflichtige Google Places/Routes-Anbindung. Routensortierung verwendet Luftlinie, keine Verkehrsprognose.
- Keine garantierte Offline-Synchronisierung. Schreibvorgänge benötigen Netz; bei Fehlern bleiben Formulare geöffnet.
- Automatische Backups/PITR hängen vom bestehenden Supabase-Tarif ab und sind nicht durch den Frontend-Export ersetzt. Wiederherstellung testen, bevor der Hub geschäftskritisch genutzt wird.
