import { useState } from "react";
import { client } from "../lib/client";
import {
  CalendarDays,
  Download,
  ExternalLink,
  ShieldCheck,
  Database,
  RefreshCw,
} from "lucide-react";
import { useStore } from "../lib/store";
import { Card, External, Badge } from "../components/UI";
import { today, dateLabel } from "../lib/calculations";
import { checkedAt, pricingSource } from "../lib/sumup";
export function Settings() {
  const { data, demo, refresh } = useStore();
  const [icloud, setIcloud] = useState("unverified");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [icloudBusy, setIcloudBusy] = useState(false);
  const [icloudMessage, setIcloudMessage] = useState("");
  async function calendarAction(action:"status"|"sync"){
    if(demo)return;
    setIcloudBusy(true);setIcloudMessage("");
    try{
      const {data:result,error}=await client.functions.invoke("nx-icloud-sync",{body:{action}});
      if(error)throw Error("iCloud-Status derzeit nicht erreichbar.");
      setIcloud(String(result?.status||"error"));
      if(result?.status==="not_connected")setIcloudMessage("Noch nicht verbunden. Apple-Zugangsdaten werden ausschließlich serverseitig eingerichtet; im CRM wird kein Passwort abgefragt.");
      else if(result?.status==="configured")setIcloudMessage("Serverseitige Verbindung konfiguriert. Kalender „neXaro Außendienst“ ist als Ziel hinterlegt.");
      else if(result?.status==="synced"||result?.status==="partial")setIcloudMessage("Kalenderabgleich: "+Number(result.synced||0)+" Termine übertragen, "+Number(result.deleted||0)+" entfernt, "+Number(result.errors||0)+" Fehler.");
      else setIcloudMessage(String(result?.error||"Status konnte nicht ermittelt werden."));
    }catch(e){setIcloudMessage((e as Error).message);}
    finally{setIcloudBusy(false);}
  }
  async function emailAction(action:"smtp-check"|"send-self-test"){
    if(demo||emailBusy)return;
    setEmailBusy(true);setEmailStatus("");
    try{
      const {data:result,error}=await client.functions.invoke("nx-email-appointments",{body:{action}});
      if(error||!result?.ok){
        setEmailVerified(false);
        const reason=String(result?.reason||"Die Verbindung konnte nicht bestätigt werden.");
        setEmailStatus(reason+(result?.code?" ("+String(result.code)+")":""));
      }else if(action==="smtp-check"){
        setEmailVerified(true);
        setEmailStatus("✓ Webador SMTP-Verbindung und STARTTLS-Anmeldung erfolgreich. Es wurde keine E-Mail verschickt.");
      }else{
        setEmailStatus("Test-E-Mail an kontakt@nexaro-solutions.de vom SMTP-Server angenommen. Bitte Posteingang und Spam prüfen. Es wurden keine Kunden kontaktiert.");
      }
    }catch{
      setEmailVerified(false);setEmailStatus("Der Webador SMTP-Test ist derzeit nicht erreichbar. Bitte Verbindung und Secrets prüfen.");
    }finally{setEmailBusy(false)}
  }
  function backup() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "nexaro-sales-hub",
            version: 1,
            exportedAt: new Date().toISOString(),
            demo,
            data,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `nexaro-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="section-intro">
        <div>
          <h1>Dein System</h1>
          <p>Verbindungen, Datenstand und Sicherung im Überblick.</p>
        </div>
        <Badge>Einzelnutzer-Betrieb</Badge>
      </div>
      <div className="analysis-grid">
        <Card title="Daten & Zugriff" eyebrow="ZENTRAL GESPEICHERT">
          <div className="settings-item">
            <ShieldCheck />
            <div>
              <strong>Persönlicher Zugang</strong>
              <p>
                Nur das freigeschaltete Administratorkonto kann CRM-Daten lesen
                und bearbeiten. Die Prüfung erfolgt auch in der Datenbank.
              </p>
            </div>
          </div>
          <div className="settings-item">
            <Database />
            <div>
              <strong>
                {demo
                  ? "Demo · Daten nur im Arbeitsspeicher"
                  : "Supabase · EU-Region Irland"}
              </strong>
              <p>
                {demo
                  ? "Änderungen verschwinden beim Neuladen. Es werden keine Demo-Daten übertragen."
                  : "Kunden, Aufgaben, Routen und Angebote werden zentral gespeichert. Nicht gespeicherte Eingaben bleiben lokal im geöffneten Formular."}
              </p>
            </div>
          </div>
          <button className="secondary" onClick={() => void refresh()}>
            <RefreshCw size={16} /> Daten neu laden
          </button>
        </Card>
        <Card title="Apple iCloud-Kalender" eyebrow="CRM → ICLOUD · 30 MIN ERINNERUNG">
          <div className="settings-item"><CalendarDays /><div>
            <strong>neXaro Außendienst</strong>
            <p>Eigener iCloud-Kalender, ausschließlich Termine aus dem CRM. Änderungen aus iCloud werden nicht zurück ins CRM übernommen.</p>
            <p><strong>Status:</strong> {icloud==="configured"||icloud==="synced"?"Konfiguriert":icloud==="partial"?"Teilweise synchronisiert":icloud==="not_connected"?"Einrichtung ausstehend":"Noch nicht geprüft"}</p>
          </div></div>
          <div className="button-row">
            <button className="secondary" disabled={demo||icloudBusy} onClick={()=>void calendarAction("status")}>
              <RefreshCw size={16}/> Verbindungsstatus prüfen
            </button>
            {(icloud==="configured"||icloud==="synced"||icloud==="partial")&&
              <button className="primary" disabled={demo||icloudBusy} onClick={()=>void calendarAction("sync")}>
                <CalendarDays size={16}/> Jetzt synchronisieren
              </button>}
          </div>
          {icloudMessage&&<p role="status" className="hint">{icloudMessage}</p>}
          <p className="hint">Der CalDAV-Zugriff bleibt deaktiviert, bis du dein iCloud-Konto eingerichtet und die serverseitige Verbindung freigegeben hast. Niemals dein Apple-Passwort im CRM oder Chat eingeben.</p>
        </Card>
        <Card title="E-Mail-Terminbestätigung" eyebrow="WEBADOR · VERSAND NOCH NICHT AKTIV">
          <div className="settings-item"><ShieldCheck/><div>
            <strong>kontakt@nexaro-solutions.de</strong>
            <p>Vorbereitete SMTP-Verbindung mit mail.webador.com über STARTTLS (Port 587).
              Testaktionen betreffen ausschließlich das eigene Postfach. Automatische Kundennachrichten sind noch nicht freigegeben.</p>
          </div></div>
          <div className="button-row">
            <button className="secondary" disabled={demo||emailBusy} onClick={()=>void emailAction("smtp-check")}>
              <RefreshCw size={16}/> {emailBusy?"Prüfung läuft …":"SMTP-Verbindung prüfen"}
            </button>
            <button className="primary" disabled={demo||emailBusy||!emailVerified}
              onClick={()=>void emailAction("send-self-test")}>
              Test-E-Mail an eigenes Postfach senden
            </button>
          </div>
          {emailStatus&&<p role="status" className="hint">{emailStatus}</p>}
          <p className="hint">Der Testversand ist eine echte E-Mail und wird nur nach Klick ausgelöst. Ein erfolgreicher SMTP-Test bestätigt noch nicht die Zustellung in den Posteingang. Bitte Zugangsdaten ausschließlich in Supabase Secrets verwalten.</p>
        </Card>
        <Card title="Datensicherung">
          <p>
            Exportiere regelmäßig eine Kopie deiner CRM-Datensätze und bewahre
            sie geschützt auf. Die Datei enthält auch Kontaktdaten und
            Einkaufspreise.
          </p>
          <button className="primary" onClick={backup}>
            <Download size={16} /> JSON-Sicherung herunterladen
          </button>
          <p className="hint">
            Hochgeladene Dokumente sind nicht in dieser JSON-Datei enthalten.
            Sichere diese zusätzlich aus den Kundenakten bzw. dem privaten
            Storage-Bucket. Der Export ersetzt keine automatisch überwachte
            Datenbanksicherung. Wiederherstellung und Datenbank-Backups sind im
            Betriebsleitfaden beschrieben.
          </p>
          <External href="https://github.com/neXaro-Solutions/nexaro-sales-hub/blob/main/docs/OPERATIONS.md">
            Betriebsleitfaden
          </External>
        </Card>
        <Card title="SumUp-Datenstand">
          <Badge>{dateLabel(checkedAt)}</Badge>
          <p>
            Öffentliche Konditionen mit festgehaltenem Quellenstand. Bestehende
            Angebote behalten ihre Berechnungsgrundlage. Eine Aktualisierung
            wird erst nach Prüfung übernommen.
          </p>
          <External href={pricingSource}>
            Aktuelle SumUp-Konditionen prüfen
          </External>
        </Card>
        <Card title="Öffentliche Kontaktanfragen">
          <p>
            Neue Anfragen legen automatisch eine Kundenakte, die gewählten
            Verkaufschancen und eine Aufgabe zur Nachverfolgung an.
          </p>
          <External href="https://nexaro-solutions.github.io/new-nexaro-field-sales-crm/public-lead.html">
            Bestehendes Kontaktformular öffnen
          </External>
          <p className="hint">
            Diese feste Adresse wird über das bisherige GitHub-Repository
            bereitgestellt.
          </p>
        </Card>
      </div>
    </>
  );
}
