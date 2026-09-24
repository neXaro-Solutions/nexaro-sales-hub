# neXaro HUNTER – Core (2026-09-24)

## Integrationsziel
Bestehendes React/Vite Sales Hub `/hub/`; Navigation `neXaro HUNTER`.
Zielgruppe: persönliche SumUp-B2B-Außendienstbesuche Berlin/Brandenburg; keine kostenpflichtige Datenquelle und keine zweite Kundenakte.

## Bestehende Architektur
- `src/lib/maps.ts`: manuell ausgelöste Geocodierung und OSM/Overpass-Geschäftssuche, Caches und Cooldown; `isExcludedChain` und `isExcludedPublicFacility` werden vor Trefferanzeige angewendet. Die bestehende Standortsuche in Tagesroute und Kundenformular bleibt unverändert.
- `nx_customers` ist zentrale Kundenakte; SumUp-Chancen hängen an `nx_opportunities`; Wiedervorlagen und Termine an `nx_tasks`; Tagesrouten an `nx_routes`.
- Hunter-Merkliste `nx_hunter_prospects` speichert manuell ausgewählte Geschäfte als **Kandidaten** mit OSM-Quellenkennung, Status und Gesprächsnotiz; owner-only RLS.
- Erst bei `Ins CRM übernehmen` werden Kunden und ihre SumUp-Chance zentral angelegt. Vorher Duplikatsprüfung nach OSM-Quellenkennung und Unternehmensname+Adresse. Existierende Kunden werden verknüpft. Diese Prüfung ist konservativ, keine vollständige rechtssichere Entitätsauflösung.
- Keine automatischen Werbenachrichten, keine Massenanrufe, keine Verarbeitung erfundener Kontaktdaten.

## Bedienung
1. Im Hub `neXaro HUNTER` öffnen, Ort/PLZ und einen kleinräumigen Suchradius 1/2/5/10 km wählen. Region nur überschlägig via Koordinaten-Box begrenzt, keine exakte Landesgrenze.
2. Branche auswählen; öffentliche Suchanfrage bewusst auslösen. Karten-/Maps-Abgleich von realem Geschäft selbst vornehmen.
3. Treffer `Vormerken`: eindeutige Kennung verhindert denselben OSM-Standort in der Hunter-Liste erneut anzulegen; bestehende CRM-Kunden erscheinen als bereits vorhanden.
4. Hunter-Status und tatsächliches Besuchsergebnis erfassen; bei relevanten Kontakten `Ins CRM übernehmen`.
5. Vorhandene `Kunden & Leads`, `Tagesroute`, `SumUp`, `Aufgaben` und `Angebote` für die weitere Bearbeitung nutzen.

## Kostenlos & Grenzen
Keine neuen externen Verträge oder Keys. Es gelten die Nutzungsregeln und Verfügbarkeitsgrenzen der öffentlichen OSM-Dienste. Es gibt keine flächendeckende, dauerhafte Unternehmensdatenbank, keine Garantie auf Vollständigkeit oder korrekte Öffnungszeiten. UI markiert Daten als nicht verifiziert. Auf massenhafte Gebietsabfragen wurde bewusst verzichtet.

## Als nächstes
Erweiterung um ausdrückliche Termin-/Wiedervorlagen-Schnellaktionen innerhalb Hunter, sichere Kontaktkanal- und Widerspruchsnotizen, dedizierte Mehrpunkt-Touren aus Hunter-Merkliste und Prüfung realer Standortsuche in Berlin/Brandenburg.
