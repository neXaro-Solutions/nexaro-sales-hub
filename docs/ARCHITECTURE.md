# Architektur und Sicherheitsgrenzen

## Aufbau

React + TypeScript + Vite, Supabase Auth / PostgreSQL und eine separate öffentliche Edge Function. Keine UI-Patches, kein global veränderbares CRM-Objekt und keine Kundenhaltung in `localStorage`. Der Auth-Client verwendet `sessionStorage` mit automatischer Token-Erneuerung. Der serverseitig verifizierte Benutzer muss zusätzlich in der nicht selbst beschreibbaren Tabelle `nx_owner` stehen.

Gemeinsame Stammdaten: `nx_customers`. Fachliche Trennung: `nx_opportunities.division`, entsprechende Angebote, Aufgaben und Gesprächsdaten. SumUp- und Vape-Potenziale haben unterschiedliche Einheiten und werden im Dashboard bewusst separat dargestellt. Der einzige Inhaber hat Zugriff auf beide Bereiche; es wird keine künstliche Mehrnutzer-Mandantentrennung behauptet.

Die Fachmodule teilen kleine UI-Komponenten und geprüfte Rechenfunktionen. JSONB wird für versionsgebundene Analysen, Angebotspositionen und Routensnapshots verwendet; Kernbeziehungen sind Fremdschlüssel. Angebotsbeträge werden unabhängig vom Browser in PostgreSQL neu berechnet.

## Zugriff

- RLS auf jeder neuen Tabelle. Kein anonymer Tabellenzugriff, auch nicht auf das Formularziel.
- Nur `nx_owner.user_id = auth.uid()` darf CRUD auf CRM-Tabellen ausführen.
- `nx_owner` ist für Clients nur zum Lesen des eigenen Eintrags freigegeben; keine Selbstfreischaltung.
- `SECURITY INVOKER` für neue Funktionen, festgesetzter leerer `search_path`, explizite Funktionsrechte.
- Formular-RPC ausschließlich für `service_role`, nicht für `anon` oder normale angemeldete Nutzer.
- Import erfolgt atomar unter den Berechtigungen des angemeldeten Inhabers.
- Änderungen verwenden eine Versionsspalte: gleichzeitige Bearbeitung führt zu einem Konflikthinweis statt stillen Überschreibens.
- React maskiert Benutzertexte; keine `dangerouslySetInnerHTML`-Ausgabe. Keine öffentlichen Kunden- oder Einkaufspreisdaten im Repository.
- CSP, ausgehende Links mit `noopener`, im Build gebündelte Abhängigkeiten und exakte Paketversionen mit Lockfile.

## Öffentlicher Eingang

1. Browser fordert eine signierte, kurzlebige Challenge an.
2. Endpoint prüft Origin, HMAC, Mindestdauer (2 Sekunden), Höchstdauer (1 Stunde), Honeypot, Größe und zulässige Felder.
3. Server hasht die übermittelte IP kryptografisch; die Anwendung speichert keine rohe IP.
4. Datenbanktransaktion begrenzt neue Anfragen auf 5 je IP-/15-Minuten-Fenster und global 100 je Stunde.
5. Eine Anfrage-ID verhindert Doppelanlage bei Netzwerk-Wiederholungen. Kunde, Verkaufschancen und Aufgaben entstehen gemeinsam oder gar nicht.

Dies ist Missbrauchsbegrenzung, kein Nachweis, dass ein Mensch absendet. Ein Angreifer kann öffentliche Challenges anfordern; globales Limit begrenzt Datenbankfüllung. Bei tatsächlichem Spam kann ein zusätzlicher CAPTCHA-/WAF-Dienst nötig sein. Die Origin-Prüfung ist kein Ersatz für Autorisierung. Der öffentliche Endpunkt gibt keine Kundendaten zurück.

## Bestehendes Projekt

Das Supabase-Projekt enthält ältere Händlerportal-Funktionen außerhalb des neuen `nx_*`-Schemas. Der Security Advisor meldete öffentlich aufrufbare SECURITY-DEFINER-Funktionen und deaktivierten Schutz vor kompromittierten Passwörtern. Diese vorhandenen Portalabläufe wurden nicht verändert. Der Hub behauptet deshalb keine vollständige Sicherheitsfreigabe des gesamten Projekts.

Die fehlenden RLS-Policies auf `nx_intake_limits` und `nx_intake_receipts` sind absichtlich: Clients haben keine Tabellenrechte, RLS verweigert zusätzlich jeden Zugriff. Nur der Backend-Service verarbeitet diese Tabellen.
