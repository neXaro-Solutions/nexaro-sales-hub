# E-Mail-Terminbestätigung (ersetzt Twilio)

Der alte SMS-Job `nx-sms-dispatch` wurde am 24.09.2026 beendet. Der alte Dispatch-Endpunkt wurde serverseitig deaktiviert (HTTP 410). Bereits vorhandene kundenseitige Bestätigungslinks bleiben unter `nx-sms-appointments?token=...` erreichbar. Der technische Name dieser Link-Funktion sowie der internen Tabelle `nx_sms_appointments` sind reine Legacy-Bezeichnungen; es werden über sie keine SMS mehr versendet.

## Status

- Die CRM-Oberfläche spricht von E-Mail, nicht SMS. Die Termin-Einwilligung ist pro Termin zunächst ausgeschaltet; bestehende Datensätze bleiben erhalten.
- Die neue Supabase-Funktion `nx-email-appointments` wurde bereitgestellt, startet jedoch **keinen Versand**, solange SMTP-Konfiguration, `NX_EMAIL_ENABLED=true` und ein neuer Cron-Job fehlen.
- Die vorhandene Vault-Eintragung `nx_sms_cron_secret` und das Edge Secret `NX_SMS_CRON_SECRET` werden für die Signatur des künftigen E-Mail-Jobs weiterverwendet; die Bezeichnung ist historisch und erfordert keinerlei Twilio-Nutzung.
- Automatisch nur um 12:00 bis 12:29 in `Europe/Berlin`. Keine E-Mails für Termine außerhalb des folgenden Kalendertags oder Termine ohne freigegebene E-Mail.
- Der Kunde bestätigt oder schickt einen Änderungswunsch über einen persönlichen, einmalig für diesen Termindurchlauf gültigen Link. Ein Änderungswunsch verschiebt den CRM-Termin nicht automatisch.

## Nächste Einrichtungsschritte (nicht ohne Postfachinhaber abschließen)

Zunächst beim Betreiber von `kontakt@nexaro-solutions.de` die kostenneutralen SMTP-Nutzungsbedingungen / Limits sowie SMTP-Host, TLS-Port und Auth-Methode erfragen. Server-Secrets in **Supabase → Edge Functions → Secrets** speichern. NIE per Chat senden, NIE im Frontend / GitHub speichern.

| Secret | Beispiel / Bedeutung |
|---|---|
| `SMTP_HOST` | Hostname des vorhandenen Mailproviders |
| `SMTP_PORT` | `465` für SSL/TLS oder `587` für STARTTLS nach Vorgabe |
| `SMTP_USER` | Benutzername für den vorhandenen SMTP-Account |
| `SMTP_PASSWORD` | SMTP-/App-Passwort; möglichst separates App-Passwort |
| `SMTP_FROM` | Verifizierte Absenderadresse, z. B. `neXaro Solutions <kontakt@nexaro-solutions.de>` |
| `NX_EMAIL_ENABLED` | Ausschließlich nach erfolgreichem Versandtest auf `true` |

Die neue Versandfunktion nutzt SMTP per Nodemailer serverseitig. Das ist keine Garantie, dass der bestehende Provider SMTP zu allen Adressen und in ausreichender Menge erlaubt. DNS/SPF/DKIM/DMARC und Zustellbarkeit nach Providerhinweisen prüfen. Bei externen Anbietern kann ein eigener Vertrag/Kosten entstehen. Der kostenlose Supabase-Auth-Standardmailer ist **keine** Lösung für reguläre Kunden-Terminmails.

Nach Einrichtung und sicherem Test Cron neu anlegen (nicht automatisch vorzeitig):
```sql
select cron.schedule(
 'nx-email-dispatch',
 '*/5 10,11 * * *',
 $$
 select net.http_post(
  url := 'https://hbuqzdmjqvgybwohfnqy.supabase.co/functions/v1/nx-email-appointments',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'x-nx-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='nx_sms_cron_secret' limit 1)
  ),
  body := '{"action":"dispatch"}'::jsonb
 );
 $$
);
```

Für einen unmittelbaren Test außerhalb des mittäglichen Versandfensters ist ein **separater, authentifizierter Testmodus** erforderlich; niemals dafür die Zeitprüfung der normalen Kundenauslieferung aufweichen.

## Webador – bestätigte Postfachkonfiguration

Webador dokumentiert: `mail.webador.com`, SMTP `587` mit STARTTLS, Benutzername die vollständige Postfachadresse. Das Passwort ist das **Postfachpasswort**, nicht das Passwort zum Einloggen bei Webador. Voraussetzung ist, dass das vorhandene Postfach mit dem Webador-Tarif bereits enthalten ist. Webador dokumentiert externen Mailprogrammzugriff, allerdings keine uneingeschränkte Massenversand-Freigabe; das Versandvolumen vor Produktivbetrieb beim Anbieter klären.

In Supabase Edge Functions → Secrets:

```text
SMTP_HOST=mail.webador.com
SMTP_PORT=587
SMTP_USER=kontakt@nexaro-solutions.de
SMTP_PASSWORD=<individuelles Webador-Postfachpasswort; niemals im Chat/GitHub>
SMTP_FROM=neXaro Solutions <kontakt@nexaro-solutions.de>
```

Die Edge Function verlangt nun STARTTLS, mindestens TLS 1.2. `NX_EMAIL_ENABLED` erst nach Freigabe und Test auf `true` setzen. Die vorgeschlagene Verwendung des bestehenden Postfaches benötigt möglicherweise keine Zusatzlizenz; die automatische Verwendung als CRM-Mailer und tägliche Versandlimits sind separat zu bestätigen.

Quelle: https://help.webador.com/hc/de/articles/29426718005777-E-Mail-Postfach-mit-deinem-E-Mail-Programm-verkn%C3%BCpfen
