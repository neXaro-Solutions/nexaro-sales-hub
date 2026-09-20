# Händlerverwaltung und Systemprüfung · 20.09.2026

## Umsetzung

Der Bereich **Händlerverwaltung** ersetzt die bisherige Katalogansicht in der Navigation. Er enthält bekannte Firmenkontakte, Gesprächsnotizen, Termine, Wiedervorlagen und private Kontaktunterlagen. Es wurden keine Händlerprodukte importiert und keine Daten gelöscht. Die zentrale Kundenakte bleibt dieselbe; Termine und Notizen erscheinen auch in den zentralen Ansichten. Der interne Bereichsschlüssel `vape` bleibt aus Kompatibilitätsgründen bestehen.

Unter **Kontakte & Dokumente** eine Kundenakte öffnen. Dort können Notizen dokumentiert, Wiedervorlagen mit Art/Datum/Uhrzeit/Hinweisen angelegt und Dokumente hochgeladen oder heruntergeladen werden. Neue Kontakte starten in diesem Bereich mit der richtigen Zuordnung. **Termine & Wiedervorlagen** zeigt bereichsbezogene und zentral zugeordnete Aufgaben.

Die Dokumentenablage nutzt den privaten Supabase-Bucket `nx-client-documents`. Erlaubt sind PDF, JPG, PNG, WebP und TXT, maximal 10 MiB. Dateien werden nicht überschrieben, sondern bekommen eindeutige Pfade. Der Client prüft Dateityp und Kennung; dies ersetzt keinen Virenscanner. Ein Download benötigt die angemeldete Sitzung. Löschungen benötigen eine ausdrückliche Bestätigung und sind im CRM nicht rückgängig zu machen. In der Demo bleiben Dateien ausschließlich im Arbeitsspeicher.

## Gefundene und behobene Fehler

| Befund | Korrektur |
| --- | --- |
| Vertriebsstudio behielt Werte beim Wechsel der Kundenakte | Kundenbezogene Instanz, gespeicherte Studio-Daten wieder laden, eigener Speichern-Knopf |
| Bestätigte Ist-Kosten von 0 Euro konnten die Gebührenformel auslösen | Explizite Auswahl zwischen Gesamtkosten und Gebührenformel |
| Hardware-Rabatt konnte im Vergleich anders runden als im Angebot | Einzelpreis vor Mengenmultiplikation runden |
| Unbestätigte Preise/fehlende Hardwarepositionen | Keine leeren Hardwareangebote; unbekannte Preise müssen ergänzt werden |
| Geschäftskonto-Plus-Bruttopreis floss in Nettovergleich | Bestätigten Nettowert separat verlangen |
| Kartenmix-Änderung ließ Bestätigung bestehen | Bestätigung bei Änderung von Mix/Volumen zurücksetzen |
| Aufgaben ohne sichtbare Uhrzeit, Abhängigkeit von Gerätezeitzone | Deutsche Ortszeit für Eingabe und Anzeige; ungültige/doppelte Zeitumstellungszeiten abweisen |
| Gespeicherte Notiz blieb im Eingabefeld | Nach erfolgreichem Speichern leeren; Doppelsubmit-Sperre |
| Veralteter Ladefehler konnte neuen Status überschreiben | Ergebnis und Fehler an aktuelle Ladegeneration binden |
| Wetterabfrage konnte unbegrenzt laden | 15-Sekunden-Zeitlimit mit sichtbarer Wiederholmöglichkeit |
| Dateiupload erhielt denselben kurzen Timeout wie kleine Datenanfragen | Separates 120-Sekunden-Limit für Storage, Größenlimit bleibt 10 MiB |
| OCR konnte negative Zahlen/Datumsangaben missverständlich erkennen | Zusätzliche konservative Ausschlussregeln; alte OCR-Läufe überschreiben keinen neuen Fortschritt |
| Ältere Staff-Prüfung nutzte E-Mail als alternative Autorisierung | Nur aktive, passende Auth-Benutzer-ID berechtigt |
| Unnötige öffentliche Aufrufrechte auf Legacy-Funktionen | Triggerfunktionen nicht mehr durch Browser-Rollen aufrufbar; drei geschützte RPCs nicht mehr anonym aufrufbar |

## Prüfungen

- TypeScript-Prüfung, Produktionsbuild und 34 Unit-Tests, darunter Perioden-/Tarifberechnung, Dateivalidierung, Kundenpfade, Zeitumstellung und Rundung.
- Automatisierte Desktop-/Mobilabläufe für Kontaktformularfehler und Wiederholung, zentrale CRM-Verknüpfung, Aufgaben/Routen, Anmeldeschutz, neutrale Händlerkontakte, Notizen, Termine, Dokumentupload/-download/-löschbestätigung, Studio-Kundenwechsel, Wetterfehler/-wiederholung und echte lokale OCR mit synthetischem Bild.
- SQL-Prüfung `tests/database-access.sql`: Owner kann Kundendokument-Metadaten lesen/schreiben; fremde und anonyme Rollen nicht. Unbekannte Kundenpfade werden abgewiesen. Ein fremder Benutzer mit nachgebildeter Staff-E-Mail erhält keine Staff-Berechtigung. Alle synthetischen Daten werden zurückgerollt. Die Prüfung lädt keine echten Dokumentbytes hoch.
- RLS auf sämtlichen `nx_*`-Tabellen aktiv. Bucket privat, Uploadgrenze und MIME-Liste überprüft. Keine Testkunden oder Testobjekte verblieben.
- `npm audit --omit=dev`: keine bekannten Schwachstellen der Produktionsabhängigkeiten zum Prüfzeitpunkt.
- Vorhandene Wetter-/GPS-/30-km-Recherche- und SumUp-Studio-Änderungen aus dem aktuellen Hauptzweig übernommen, nicht überschrieben.

## Offene Punkte und Aussagegrenzen

Dies ist eine nachvollziehbare Funktions-/Konfigurationsprüfung, kein unabhängiger Penetrationstest, keine Lastprüfung und keine Garantie auf Fehlerfreiheit.

Die echte Anmeldung mit dem Inhaberpasswort und ein echter authentifizierter Storage-Byteupload wurden nicht ausgeführt. Berechtigungen wurden auf Datenbankebene geprüft; Dateiverhalten zusätzlich im isolierten Demomodus. Keine Zugangsdaten wurden übernommen. Kameraqualität unterschiedlicher Geräte, GPS im Außendienst und alle Abrechnungslayouts sind damit nicht vollständig abgedeckt.

**Passwortschutz:** Der Supabase-Advisor meldet weiterhin deaktivierten Schutz gegen bekannte kompromittierte Passwörter. Die vorhandene Verbindung bietet keine Änderung dieser Auth-Projekteinstellung. In den [Auth-Einstellungen](https://supabase.com/dashboard/project/hbuqzdmjqvgybwohfnqy/auth/providers) prüfen und aktivieren, soweit im Tarif verfügbar. [Erläuterung von Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Legacy-Funktionen:** Anonym aufrufbare SECURITY-DEFINER-Funktionen wurden von neun auf zwei reduziert: `is_staff()` ist bewusst eine boolesche Zugriffsprüfung (ohne gültige Benutzer-ID immer falsch). `verify_push_webhook` bleibt bis zur gesonderten Prüfung seines externen Aufrufers unverändert. Für angemeldete Rollen bleiben sechs funktionsbezogene Advisor-Hinweise. Diese sind nicht automatisch eine ausnutzbare Sicherheitslücke; bestehende Rollenprüfungen wurden nicht entfernt. [Advisor: öffentliche Funktionen](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [angemeldete Rollen](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Die beiden Intake-Metadaten-Tabellen haben absichtlich keine Client-Policies: Tabellenrechte entzogen und RLS verweigert zusätzlich. [Advisor-Einordnung](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Der Performance-Advisor meldet ältere Portal-Indizes/Policies außerhalb der neuen Verwaltung: einen nicht abgedeckten Fremdschlüssel und wiederholte Auth-Prüfungen. Keine produktbezogenen Altportal-Abfragen wurden erweitert. Unbenutzte Indizes wurden nicht vorschnell gelöscht. [Fremdschlüssel-Index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS-Auswertungen](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [mehrere Policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).

**Sicherung:** Der JSON-Export enthält CRM-Datensätze, nicht hochgeladene Dokumentdateien. Dokumente zusätzlich separat sichern. Automatische Datenbank-/Storage-Backups, Wiederherstellung und Virenscan sind nicht eingerichtet oder als geprüft ausgewiesen.

Quellen für die neue Ablage: [Storage-Zugriffsregeln](https://supabase.com/docs/guides/storage/security/access-control), [geschützte Downloads](https://supabase.com/docs/guides/storage/serving/downloads). Aktuelle Supabase-Änderungen wurden im [Changelog](https://supabase.com/changelog) geprüft; für verwendete Standard-Uploads und RLS wurde keine relevante inkompatible Änderung erkannt.
