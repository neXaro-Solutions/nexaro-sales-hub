import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, Search } from "lucide-react";
import { Card, DivisionBadge } from "../components/UI";

type Article = {
  group: string;
  title: string;
  summary: string;
  points: string[];
  source?: string;
};

const articles: Article[] = [
  { group: "Außendienst", title: "Gesprächsablauf in vier Schritten", summary: "Vom vorhandenen Zahlungsbeleg zur überprüfbaren Empfehlung.", points: ["1. Händlerabrechnung fotografieren oder Werte manuell erfassen.", "2. Branche, Transaktionen, Mobilität und Belegbedarf aufnehmen.", "3. Kartenmix und Kosten mit dem Händler prüfen.", "4. Tarif und Hardware getrennt darstellen, Angebot speichern und Wiedervorlage vereinbaren."] },
  { group: "Außendienst", title: "Foto und OCR richtig nutzen", summary: "Die Erkennung ist ein Eingabehelfer, kein verifizierter Rechnungsnachweis.", points: ["Beleg vollständig, gerade und gut beleuchtet fotografieren.", "Monatszeitraum, Kartenumsatz, Gebühren und Kartentypen prüfen.", "Unlesbare Werte nie als 0 oder als bestätigte Werte interpretieren.", "Originalbeleg und sensible Kundendaten nur im geschützten CRM ablegen."] },
  { group: "Kartenmix", title: "80/20-Startannahme", summary: "80 % Debit und 20 % Kredit sind eine Voreinstellung, keine Eigenschaft eines konkreten Händlers.", points: ["Startwerte nur verwenden, solange kein echter Kartenmix bekannt ist.", "Nach Belegprüfung Kartentypen und Sonderkarten anpassen.", "Internationale, Corporate, Premium, Amex und Online separat berücksichtigen.", "Schätzung im Angebot von nachgewiesenem Ist-Wert unterscheiden."] },
  { group: "Tarife", title: "Standard und Zahlungen Plus", summary: "Vergleiche die monatlichen Gesamtkosten inklusive möglicher Grundgebühr.", points: ["Kartentyp und Kanal beeinflussen den anzuwendenden Satz.", "Zahlungen Plus nicht ungeprüft auf jeden Kartentyp anwenden.", "Aktuelle Bedingungen und mögliche Sonderkonditionen vor Abschluss anhand der offiziellen Preisseite prüfen.", "Historische Belege nicht automatisch als künftige Kosten darstellen."], source: "https://www.sumup.com/de-de/preise/" },
  { group: "Tarife", title: "Individuelle Konditionen", summary: "Ein großes Zahlungsvolumen allein bestätigt keine individuelle Kondition.", points: ["Bedarf und Gesamtvolumen dokumentieren.", "Verbindliche Konditionen nur aus einer gültigen SumUp-Freigabe übernehmen.", "Im Vergleich deutlich als Anfrage oder Angebot vorbehaltlich Prüfung ausweisen."], source: "https://www.sumup.com/de-de/preise/" },
  { group: "Hardware", title: "Reguläre Referenzpreise netto", summary: "Solo Lite 34 €, Solo 79 €, Terminal 169 €; keine Aktions-, Wochen- oder Rabattpreise.", points: ["Solo Lite: Betrieb zusammen mit Smartphone und App.", "Solo: eigenständige mobile Kartenzahlung.", "Terminal: integrierte Belegdruckfunktion.", "Lieferumfang, Zubehör, Steuern und tatsächlich gültige Preise vor Vertragsschluss prüfen."], source: "https://www.sumup.com/de-de/kartenterminals/" },
  { group: "Hardware", title: "Hardwarebedarf erfragen", summary: "Das günstigste Terminal ist nicht automatisch das funktional passende.", points: ["Smartphone am Verkaufspunkt verfügbar?", "Ist eigenständige Nutzung wichtig?", "Papierbeleg oder digitaler Beleg?", "Kassensystem, Mobilfunk, gleichzeitige Geräte oder Zubehör nötig?"], source: "https://www.sumup.com/de-de/kartenterminals/" },
  { group: "Kasse", title: "POS-Free / Plus / Pro prüfen", summary: "Kassenfunktionen, Lizenz und Zusatzkosten getrennt vom Kartenterminal aufnehmen.", points: ["Bedarf an Artikelverwaltung, Mitarbeitern und Berichten aufnehmen.", "Branchenspezifische Abläufe und Integrationen demonstrieren.", "Lizenzname, Leistungsumfang und tatsächliche Verfügbarkeit für Deutschland prüfen.", "Nicht pauschal behaupten, eine Lizenz ersetze alle vorhandenen Funktionen."], source: "https://www.sumup.com/de-de/" },
  { group: "Angebote", title: "Angebot und Rechnung erstellen", summary: "Nur bestätigte Preise und vollständig erfasste Kundendaten in ein Dokument übernehmen.", points: ["NeXaro-Firmendaten und Kundendaten prüfen.", "Netto, 19 % Umsatzsteuer und Brutto rechnerisch kontrollieren.", "Angebots- und Rechnungsnummer nicht versehentlich doppelt vergeben.", "PDF-/Druckvorschau vor Versand prüfen; kein EK im Kundendokument." ] },
  { group: "Vape B2B", title: "25 % Marge richtig berechnen", summary: "Marge bezieht sich auf den Netto-Verkaufspreis, nicht als bloßer Aufschlag auf EK.", points: ["Formel: VK netto = EK netto ÷ (1 − Marge / 100).", "Regelmarge 25 %, manuell bis auf 15 % reduzierbar.", "Verpackungseinheit und Einzelstück gesondert kalkulieren.", "Nicht freigegebene EK- oder VE-Angaben dürfen nicht zu verbindlichen Angeboten führen."] },
  { group: "Vape B2B", title: "VE- und Einzelverkaufsfreigabe", summary: "Standardmäßig vollständige Verpackungseinheit verwenden.", points: ["EK netto und Stückzahl je VE nach Händlerlogin abgleichen.", "Einzelstück nur anbieten, wenn der Lieferant das Produkt einzeln liefert und der Einkauf dafür geprüft ist.", "Artikel ohne freigegebene Daten nicht automatisch bepreisen."] },
  { group: "Einwände", title: "„Ich habe schon ein Terminal“", summary: "Nicht überreden, sondern konkrete Verbesserungsmöglichkeiten ermitteln.", points: ["Fragen, was an der bestehenden Lösung zuverlässig funktioniert.", "Nach dem größten offenen Problem bei Belegen, Kosten, Mobilität oder Kasse fragen.", "Mit realen Daten vergleichen statt pauschale Ersparnisse versprechen."] },
  { group: "Einwände", title: "„Ich bin zufrieden“", summary: "Aktuelle Lösung respektieren.", points: ["Kurz fragen, ob etwas fehlt oder künftig gebraucht wird.", "Falls kein Bedarf besteht: Gespräch sauber abschließen und nur mit Einwilligung nachfassen."] },
  { group: "Einwände", title: "„Schicken Sie Unterlagen“", summary: "Unterlagen auf das erklärte Interesse zuschneiden.", points: ["Nach Kosten, Funktionen und Hardwarebedarf fragen.", "Verifizierte Preisseiten und ein konkretes Angebot statt allgemeiner Versprechen nutzen.", "Folgetermin nach Absprache dokumentieren."] },
  { group: "Wettbewerb", title: "Lightspeed und bestehende Kasse", summary: "Kartenzahlung und Kassenbetrieb getrennt vergleichen.", points: ["Ist die Kasse vorhanden und im Alltag gut integriert?", "Benötigt der Händler nur Terminal oder ein neues POS?", "Integrationen und Datenmigration vor Umstellung prüfen.", "Keine pauschale Behauptung, ein Anbieter sei immer günstiger oder funktionaler."] },
  { group: "Hilfe", title: "Offizielle SumUp-Hilfe", summary: "Technische Probleme und Vertragsdetails anhand der offiziellen Dokumentation prüfen.", points: ["Problem, Gerät, App-Version und Fehlermeldung notieren.", "Nach Möglichkeit zunächst offiziellen Status und passende Hilfeseite prüfen.", "Vertrags- und Auszahlungsfragen nicht aus allgemeinen Erfahrungswerten beantworten."], source: "https://help.sumup.com/de-DE/" },
];

export function KnowledgeBase() {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("Alle");
  const groups = ["Alle", ...new Set(articles.map((article) => article.group))];
  const filtered = useMemo(() => articles.filter((article) =>
    (group === "Alle" || article.group === group) &&
    [article.title, article.summary, article.group, ...article.points].join(" ").toLocaleLowerCase("de").includes(search.trim().toLocaleLowerCase("de"))
  ), [group, search]);
  return (
    <section>
      <div className="section-intro">
        <div><DivisionBadge division="sumup" /><h1>Vertriebswissen</h1><p>Eine zentrale, durchsuchbare Wissensdatenbank im neXaro-Farbschema für unterwegs.</p></div>
        <BookOpen size={38} aria-hidden="true" />
      </div>
      <Card>
        <div className="toolbar">
          <label className="search" style={{ minWidth: 220 }}><Search size={17} /><input aria-label="Wissensdatenbank durchsuchen" placeholder="Nach Tarif, Einwand, Hardware, VE … suchen" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select aria-label="Thema filtern" value={group} onChange={(event) => setGroup(event.target.value)}>{groups.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
        <p className="hint">Vertriebsreferenz · Preise und vertragliche Konditionen vor einem verbindlichen Angebot anhand der offiziellen SumUp-Seiten prüfen. Hardware stets ohne Aktionspreise.</p>
        <p role="status" className="hint">{filtered.length} von {articles.length} Einträgen</p>
      </Card>
      {filtered.length === 0 ? <Card><p>Keine Treffer. Suchbegriff oder Filter ändern.</p></Card> : filtered.map((article) => (
        <Card key={article.title}>
          <span className="eyebrow">{article.group}</span>
          <h2>{article.title}</h2><p>{article.summary}</p>
          <ul style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.9, paddingLeft: 22 }}>{article.points.map((point) => <li key={point}>{point}</li>)}</ul>
          {article.source && <a href={article.source} target="_blank" rel="noopener noreferrer" className="text-link">Offizielle Quelle <ExternalLink size={14} /></a>}
        </Card>
      ))}
    </section>
  );
}
