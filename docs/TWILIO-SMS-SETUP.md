# Twilio SMS-Terminbestätigung – Aktivierung

Stand: 2026-09-24. Datenbanktabelle und Edge Function `nx-sms-appointments` sind im bestehenden Supabase-Projekt bereitgestellt. Der Live-Versand bleibt **aus**, bis der Kontoinhaber die folgenden Zugangsdaten und den Cron-Job sicher eingerichtet hat. Es wird keine SMS beim bloßen Speichern eines Termins ausgelöst.

## 1. Twilio einrichten

Im eigenen Twilio-Konto ein kostenpflichtiges Programmable-Messaging-Konto und eine für SMS nach Deutschland geeignete Absendernummer oder Messaging Service einrichten. Die in Twilio geltenden Anforderungen an deutsche SMS-Absender und ggf. Identitäts-/Sender-Registrierung beachten. Bei Trial-Konten können Einschränkungen für Empfänger gelten. Unter https://console.twilio.com/ die **Account SID**, den **Auth Token** und entweder **From (SMS-fähige Absendernummer)** oder **Messaging Service SID** ermitteln.

Keinen Token im Chat, in GitHub oder in einem `VITE_...`-Wert ablegen.

## 2. Supabase Edge Function Secrets

Projekt: `hbuqzdmjqvgybwohfnqy`. Unter **Supabase Dashboard → Edge Functions → Secrets** folgende Namen eintragen:

| Secret | Inhalt |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM` | SMS-fähiger Twilio-Absender; weglassen, wenn Messaging Service genutzt wird |
| `TWILIO_MESSAGING_SERVICE_SID` | Alternativ: Twilio Messaging Service SID |
| `NX_SMS_CRON_SECRET` | Neuer zufälliger Geheimwert (mind. 32 zufällige Bytes, als Hex) |
| `NX_SMS_ENABLED` | Erst nach End-to-End-Test auf `true` setzen; vorher weglassen oder `false` |

Die bereits von Supabase bereitgestellten `SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` bleiben ausschließlich auf dem Server. Falls projektbedingt nicht automatisch vorhanden, vor Aktivierung anhand der Supabase-Funktionseinstellungen prüfen.

## 3. Scheduler mit Sommer-/Winterzeit

Im Supabase SQL Editor zunächst denselben zufälligen Cron-Geheimwert (nur dort, **nicht in GitHub**) sicher in Vault speichern:

```sql
select vault.create_secret('HIER_DENSELBEN_ZUFALLSWERT_WIE_NX_SMS_CRON_SECRET_EINTRAGEN', 'nx_sms_cron_secret');
```

Anschließend den Job einmalig anlegen:

```sql
select cron.schedule(
 'nx-sms-dispatch',
 '*/5 5,6 * * *',
 $$
 select net.http_post(
  url := 'https://hbuqzdmjqvgybwohfnqy.supabase.co/functions/v1/nx-sms-appointments',
  headers := jsonb_build_object(
   'Content-Type','application/json',
   'x-nx-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='nx_sms_cron_secret' limit 1)
  ),
  body := '{"action":"dispatch"}'::jsonb
 );
 $$
);
```

Cron-Zeiten laufen in UTC: 05:30 UTC entspricht 07:30 MESZ, 06:30 UTC entspricht 07:30 MEZ. Der Job prüft alle 5 Minuten zwischen 05:00 und 06:59 UTC; die Edge Function sendet **nur zwischen 07:30 und 07:59 Europe/Berlin** und nur für Termine am aktuellen Tag, die noch nicht begonnen haben. Nicht vom Nutzer freigegebene Termine werden übersprungen. Termine vor 07:30 werden nicht rückwirkend benachrichtigt. Ein Ausfall des Jobs wird nicht durch einen späteren Versand am Tag kaschiert.

Zum Abschalten:
```sql
select cron.unschedule('nx-sms-dispatch');
```
Zusätzlich jederzeit `NX_SMS_ENABLED=false` setzen.

## 4. CRM bedienen / End-to-End-Test

1. Im bestehenden CRM einen Testkunden mit eigener Mobilnummer erfassen (`015...`, `0049...` oder `+49...`). Die Telefonnummer muss SMS empfangen können.
2. Einem künftigen Termin Kunde, Bereich (`sumup` oder `vape`) und Betreff zuweisen. Im Termin die ausdrückliche Einwilligung zu Termin-SMS abhaken; standardmäßig ist sie **aus**.
3. Vor dem Aktivieren der Versandfreigabe die Twilio-Absenderkonfiguration und SMS-Kosten überprüfen.
4. Mit Testtermin und aktiviertem `NX_SMS_ENABLED` den Scheduler am nächsten passenden Termintag prüfen; Link öffnen und Bestätigen bzw. Verschiebung mit Datum/Uhrzeit ausprobieren. Keine Produktiv-SMS ohne die Einwilligung des jeweiligen Empfängers auslösen.
5. Dashboard auf Status und Verschiebungswunsch prüfen; neuen Termin selbst im CRM speichern. Frühere Links sind nach einer Terminänderung ungültig.

Wichtige Grenzen: Twilio-Annahme ist keine gesicherte Zustellung beim Empfänger; ohne Twilio-Delivery-Status-Callback zeigt das CRM **SMS versendet** (Twilio-Auftrag angenommen), nicht **zugestellt**. Ein Klick ist für Bestätigung/Verschiebung notwendig; keine Antwort per eingehender SMS. Nach nicht eindeutig abgeschlossenem Twilio-Request kann erneutes Senden Doppel-SMS verursachen; Fehler deshalb vor manuellem Zurücksetzen in Twilio prüfen. Die Nutzereinwilligung muss tatsächlich vorliegen und dokumentiert sein. 
