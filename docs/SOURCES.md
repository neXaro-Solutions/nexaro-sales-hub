# Quellenstand 19.09.2026

## SumUp Deutschland

- https://www.sumup.com/de-de/preise/
- https://www.sumup.com/de-de/kartenterminals/
- https://www.sumup.com/de-de/solo-kartenlesegeraet/
- https://www.sumup.com/de-de/tap-to-pay/

Verwendet: umsatzbasiert 1,39 %, Plus 19 €/Monat, 0,79 % nur auf geeignete Vor-Ort-Kartenumsätze, ansonsten 1,39 %, Online 2,5 %, SumUp-Karten 0 %. Öffentliche Seiten beschreiben die Eignung teils als inländisch, teils als EWR-Verbraucherkarten; deshalb wird der berechtigte Anteil explizit eingegeben und soll anhand des tatsächlich gültigen Vertrags bestätigt werden.

Hardware: Tap to Pay 0 €, Solo Lite Aktionspreis 22 € (Referenz 34 €), Solo 59 € (79 €), Terminal 139 € (169 €), jeweils öffentliche Nettopreise ohne Versand. Keine dauerhafte Preisgarantie. Individuelle Konditionen ab 10.000 € Monatsvolumen nicht numerisch erfunden. Kassen-Abos sind nicht automatisch enthalten.

Break-even wird aus Kartenmix und Gebührendifferenz gerechnet. Marketing-Schwellen von unterschiedlichen öffentlichen Seiten werden nicht als Rechengrenze verwendet. Optional wird Zahlungen Plus mit 199 €/Jahr berücksichtigt (Quelle: Preis-FAQ und Hardwareseite, erneut geprüft am 19.09.2026). Die Jahresgebühr fließt einmal ein, die Vorauszahlung wird separat ausgewiesen.

## Karten / Recherche

- https://developers.google.com/maps/documentation/urls/get-started
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://operations.osmfoundation.org/policies/nominatim/
- https://www.openstreetmap.org/copyright

Keine Google-Places-Datenbankkopie. Unternehmensrecherche nutzt OSM-Daten mit sichtbarer Attribution; Google Maps und Street View öffnen als externe Links ohne API-Schlüssel. Nutzerbetätigte Ortssuche: maximal 1 Anfrage/Sekunde, kein Autocomplete, keine Hintergrund- oder Massengeocodierung, wiederholte Suchtexte werden im Arbeitsspeicher gecacht. Nur öffentliche Geschäftsorte eingeben. Geocoder darf nach Aufforderung des Betreibers nicht weiter benutzt werden; Konfiguration/Betrieb siehe OPERATIONS.md.

Mobile Maps-Links enthalten höchstens 3 Zwischenziele plus Endziel; längere Routen werden in zusammenhängende Etappen aufgeteilt.

## Technik

- https://supabase.com/changelog
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/guides/database/backups
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

Changelog geprüft: keine betroffenen Änderungen an verwendetem Passwort-Login/RLS erkannt. Node.js 24; Supabase-JS benötigt künftig mindestens TypeScript 5.0, verwendet wird 5.9.3.

OCR: https://github.com/naptha/tesseract.js (7.0.0), https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md und https://github.com/tesseract-ocr/tessdata. Lokale Ausführung mit selbst gehosteten, fest versionierten Sprach-/Workerdateien.
