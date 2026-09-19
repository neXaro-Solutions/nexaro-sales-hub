# Händlerabrechnung per Foto

Im Bereich **SumUp Vertrieb → Analyse & Vergleich** die Händlerabrechnung fotografieren oder als JPG, PNG bzw. WebP hochladen (maximal 15 MB und 40 Megapixel). HEIC vorher als JPG exportieren. Die deutsche OCR läuft lokal mit Tesseract.js; Sprachmodell und Worker werden von derselben Website geladen. Fotos und vollständiger Belegtext bleiben nur im Arbeitsspeicher. Im CRM werden ausschließlich bestätigte Monatswerte, Prüfzeitpunkt und Berechnungsannahmen gespeichert.

Erkannte Beträge zusammen mit den angezeigten Textstellen prüfen. Fehlende oder mehrdeutige Werte ergänzen. Abrechnungsmonate angeben und die gemeinsame Nettobasis bestätigen. Die Auszahlung ist kein Umsatz; Online-Umsatz nicht doppelt berücksichtigen. Einmalkäufe aus laufenden Vergleichskosten herausrechnen. Bei unleserlichen Belegen kann Text manuell eingefügt werden. Negative/erstattungsdominierte Abrechnungen werden nicht automatisch als positive Umsätze behandelt.

Nach Übernahme ersetzen die bestätigten Gesamtkosten die frühere Gebührenformel vollständig. Der Kartenmix startet beim Fotoimport konservativ mit 0 % rabattfähigem Anteil. Den geeigneten Anteil anhand der Abrechnung bzw. mit dem Händler prüfen und bestätigen. Bis dahin bleibt die Tarifempfehlung vorläufig.

Hardwarebedarf angeben: kompatibles Smartphone, Chipzahlungen, eigenständiger Betrieb, Belegdruck und Artikelkatalog. Die App schlägt die günstigste geeignete der vier hinterlegten Lösungen vor. Erweiterte Kassenlösungen, Zubehör und individuelle Konditionen sind nicht vollständig eingepreist. Der Hardwarevorschlag wird mit einem Klick in den Kostenvergleich übernommen.

Das Jahresabo wird nur auf Wunsch berücksichtigt; 199 Euro werden im ersten Monat als Vorauszahlung und im Jahresvergleich einmal gerechnet. Jahreswerte setzen gleichbleibenden Umsatz und Kartenmix voraus. Der günstigste hinterlegte Standardtarif ist keine Garantie für das günstigste individuelle Angebot. Öffentliche Aktionspreise vor einem verbindlichen Angebot bei SumUp prüfen.

## Betrieb

`npm run build` kopiert die fest versionierten OCR-Abhängigkeiten nach `public/ocr/` und in den Build. Den kompletten Ordner `dist/ocr/` mit veröffentlichen: Worker, Gerätevarianten des WebAssembly-Kerns, deutsches Sprachmodell und Lizenzhinweise. Keine externe OCR-API und kein KI-Schlüssel erforderlich. Der erste Scan lädt je Gerät ungefähr 5 MB; schwache Geräte brauchen länger. Abbruch und Zeitlimit sind integriert. Die CSP erlaubt ausschließlich selbst gehostete Worker und WebAssembly-Ausführung.

## Prüfung

Automatisierte Tests lesen ein synthetisches Abrechnungsfoto mit dem echten OCR-Modul auf Desktop- und Smartphone-Bildschirmgröße. Sie prüfen die Bestätigungspflicht, 5.000 Euro Umsatz, 95 Euro Belegkosten, konservativen Kartenmix und die Druckerempfehlung. Weitere Tests prüfen Periodenumrechnung, mehrdeutige Beträge, Jahresabo und das Vermeiden doppelter Gebühren. Ein einzelner Musterbeleg belegt keine Erkennungsqualität für alle Bankenlayouts, Geräte und Lichtverhältnisse.
