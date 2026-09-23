# neXaro → Apple iCloud Kalender: kontrollierte Einrichtung

## Stand
Die CRM→iCloud-CalDAV-Integration ist serverseitig vorbereitet. **Sie ist absichtlich
deaktiviert und verbindet sich nicht mit Apple**, bis der Inhaber die Einrichtung
freigibt. Weder Apple-ID noch ein Anwendungspasswort werden über den Browser,
Chat, GitHub oder CRM-Tabellen eingegeben oder gespeichert.

- Zielkalender: **neXaro Außendienst** (muss exakt so in iCloud existieren).
- Richtung: ausschließlich CRM → iCloud. Änderungen in iCloud gehen NICHT
  zurück ins CRM und können beim nächsten CRM-Update überschrieben werden.
- Quelle: offene CRM-Einträge vom Typ „Termin“. Aufgabe/Wiedervorlage wird
  NICHT exportiert. Wird ein Termin erledigt, umgewandelt oder gelöscht, wird
  ein zuvor vom CRM synchronisierter iCloud-Eintrag entfernt.
- Start: CRM-Zeitpunkt; Ende: standardmäßig 60 Minuten später; Erinnerung:
  30 Minuten vorher; Kundenanschrift im Ort und Kontaktinformationen in Notizen.
- Synchronisations-ID: die CRM-Task-UUID, um Duplikate zu vermeiden.
- Kein automatischer Import deiner bereits vorhandenen privaten Termine.

## Was der Inhaber vor Freigabe tut

1. Apple-Kalender/iCloud für das eigene Apple-Konto auf dem iPhone einschalten.
2. Unter https://www.icloud.com/calendar/ einen eigenen iCloud-Kalender
   **neXaro Außendienst** erstellen. Dafür keine öffentlichen Freigabelinks
   erstellen. Alternativ in der iPhone-Kalender-App einen neuen Kalender unter
   dem iCloud-Konto anlegen.
3. Auf https://account.apple.com im Bereich Anmelden und Sicherheit →
   Anwendungsspezifische Passwörter ein ausschließlich für „neXaro CRM“
   bestimmtes Passwort erstellen (Apple-Zwei-Faktor-Authentifizierung erforderlich).
4. Apple-ID (Anmelde-E-Mail) und das neue Anwendungspasswort **nur in Supabase
   Dashboard → Edge Functions → Secrets** eintragen:
     NX_ICLOUD_APPLE_ID       = eigene Apple-ID / Anmelde-E-Mail
     NX_ICLOUD_APP_PASSWORD  = nur das anwendungsspezifische Passwort
   Niemals das reguläre Apple-Passwort eintragen. Niemals Zugangsdaten an
   ChatGPT oder als GitHub-Commit senden. Vorerst NX_ICLOUD_ENABLED weglassen.
5. Erst nach ausdrücklicher Freigabe NX_ICLOUD_ENABLED=true setzen und unter
   CRM → System & Sicherung → Apple iCloud-Kalender den Status prüfen.
   Der erste manuelle Sync erkennt den Zielkalender über CalDAV und liefert
   bei Fehlern ausschließlich eine knappe Fehlermeldung. Bei Fehlern keine
   Zugangsdaten hier teilen.

## Backend

Supabase Edge Function nx-icloud-sync (verify_jwt=true); ausschließlich das
freigeschaltete CRM-Administratorkonto oder ein serverseitiger Service-Aufruf.
Die Funktion verwendet nur Edge-Function-Secrets, greift auf CalDAV über HTTPS
mit streng zugelassener iCloud-Domain zu, schreibt keine Passwörter in Logs oder
Datenbank und beschränkt Weiterleitungen auf iCloud.

public.nx_icloud_sync enthält allein UUID, CalDAV-URL, ETag, Versionsnummer,
Zeitpunkte und begrenzte Fehlermeldung. Row-Level-Security: lesbar nur für den
freigeschalteten CRM-Inhaber; schreibbar nur per service_role.
Nach dem Speichern eines CRM-Termins wird ein best-effort Abgleich angestoßen.
Bei vorübergehenden Störungen bleibt der Termin im CRM erhalten.

## Nach Freigabe: zuverlässig auch ohne geöffneten Browser

Für Wiederholungen und Änderungen an Kundendaten zusätzlich einen
serverseitigen 5-Minuten-Job über pg_cron + pg_net einrichten. Den Aufrufschlüssel
in Supabase Vault speichern; niemals in Klartext in SQL-Migrationen oder GitHub.
Diesen Job erst nach erfolgreichem Verbindungstest und ausdrücklicher Zustimmung
aktivieren. Die CRM-Synchronisation darf nicht ausschließlich von einem offenen
iPhone-Browser abhängen.

Beispiel für die *spätere* Administrator-Konfiguration (nur nachdem der
Vault-Eintrag `nx_icloud_worker_bearer` mit einem gültigen internen
Service-Token sicher erstellt wurde):

```sql
select cron.schedule(
 'nx-icloud-sync',
 '*/5 * * * *',
 $$
 select net.http_post(
   url:='https://hbuqzdmjqvgybwohfnqy.supabase.co/functions/v1/nx-icloud-sync',
   headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets
         where name='nx_icloud_worker_bearer')
   ),
   body:='{"action":"sync"}'::jsonb,
   timeout_milliseconds:=30000
 );
 $$
);
```

Der Job ist bei Erstellung dieses Dokuments **nicht aktiviert**. Für die
Verbindung benötigt die verantwortliche Person Administrationszugriff auf
das bestehende Supabase-Projekt.

## Rücknahme

NX_ICLOUD_ENABLED entfernen oder auf false setzen. Das getrennte
anwendungsspezifische Passwort in Apple Account widerrufen; ggf. den
geplanten Cron-Job über `cron.unschedule('nx-icloud-sync')` deaktivieren.
CRM-Kundendaten bleiben erhalten.

## Grenzen

Die CalDAV-Verbindung mit diesem Apple-Konto kann erst nach der Freigabe
gegen Apples echte Infrastruktur getestet werden. Der Status „Servercode
bereitgestellt“ ist kein Nachweis, dass iCloud bereits verbunden ist.
