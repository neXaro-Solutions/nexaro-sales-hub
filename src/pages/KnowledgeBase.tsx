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
  {
    group: "Gesprächseinstieg", title: "Erstkontakt im Geschäft · 30 Sekunden",
    summary: "Kurz, respektvoll und ohne unbestätigte Sparversprechen das Gespräch eröffnen.",
    points: [
      "Einstieg: „Guten Tag, mein Name ist Sebastian Pötschke von neXaro Solutions. Ich begleite Gewerbetreibende bei Kartenakzeptanz und passenden SumUp-Lösungen. Passt es gerade für eine kurze Frage – oder ist ein anderer Zeitpunkt besser?“",
      "Erlaubnisfrage: „Darf ich kurz fragen, wie Sie Kartenzahlungen aktuell abwickeln?“",
      "Wenn Zeit vorhanden: „Was funktioniert daran für Sie besonders gut, und wo würden Sie sich etwas Einfacheres wünschen?“",
      "Wenn es gerade nicht passt: „Verstanden. Wann wäre ein passender Zeitpunkt für ein kurzes Gespräch?“ Nur einen konkret vereinbarten Folgeschritt notieren.",
      "Keine Ersparnis, Sonderkondition oder technische Kompatibilität behaupten, bevor Ist-Daten und aktuelle Konditionen geprüft sind."
    ]
  },
  {
    group: "Gesprächseinstieg", title: "Empfang, Mitarbeiter oder Entscheider",
    summary: "Den richtigen Ansprechpartner finden, ohne Mitarbeitende zu übergehen.",
    points: [
      "Einstieg: „Guten Tag. Wer ist bei Ihnen für Kartenzahlung oder die Auswahl der Kassentechnik zuständig?“",
      "Bei Rückfrage: „Es geht um eine kurze Bestandsaufnahme der heutigen Zahlungslösung – zunächst ohne Angebot und ohne Vertragsänderung.“",
      "Ist die Person nicht da: „Wann ist sie üblicherweise erreichbar? Ich komme gern zu einem geeigneten Zeitpunkt wieder.“",
      "Nicht um private Kontaktdaten bitten, wenn diese für die vereinbarte Kontaktaufnahme nicht benötigt werden.",
      "Im HUNTER die verifizierte Gesprächsinformation und einen vereinbarten Termin eintragen; keine Vermutung als Entscheidung dokumentieren."
    ]
  },
  {
    group: "Gesprächseinstieg", title: "Bestehenden Kontakt erneut ansprechen",
    summary: "An das letzte Gespräch anknüpfen und den vereinbarten nächsten Schritt klären.",
    points: [
      "Einstieg: „Wir hatten am [Datum] über [konkretes Thema] gesprochen. Ist jetzt ein guter Zeitpunkt, um die offene Frage gemeinsam durchzugehen?“",
      "„Hat sich seit unserem Gespräch beim Kartenumsatz, der Kasse oder beim Gerätebedarf etwas verändert?“",
      "„Ich habe [vereinbarten Punkt] vorbereitet. Möchten Sie zuerst die Kosten oder den praktischen Ablauf ansehen?“",
      "Offene Einwände und Änderungen in der Kundenakte dokumentieren; keine Zustimmung zu weiteren Kontakten unterstellen."
    ]
  },
  {
    group: "Bedarfsermittlung", title: "Bedarf in fünf Fragen erfassen",
    summary: "Ein kurzer Leitfaden vom Ist-Zustand zum konkreten nächsten Schritt.",
    points: [
      "1 · Ist-Zustand: „Wie nehmen Sie heute Kartenzahlungen an – mit welchem Terminal und welcher Kassenlösung?“",
      "2 · Alltag: „Wann wird es im Betrieb aufwendig: an der Theke, unterwegs, beim Beleg oder beim Tagesabschluss?“",
      "3 · Umfang: „Wie viele Zahlungen und ungefähr welches Kartenvolumen fallen in einem typischen Monat an?“ Schätzungen ausdrücklich als solche notieren.",
      "4 · Priorität: „Wäre für Sie eher die Bedienung, die Kostenübersicht, Mobilität oder eine zusätzliche Funktion entscheidend?“",
      "5 · Entscheidung: „Wer sollte in einen Vergleich eingebunden sein, und wann möchten Sie entscheiden?“",
      "Zusammenfassen: „Ich habe verstanden: [Ist-Zustand], [Herausforderung] und [Priorität]. Trifft das so zu?“"
    ]
  },
  {
    group: "Bedarfsermittlung", title: "Gebührencheck mit einer Händlerabrechnung",
    summary: "Zahlen sorgfältig erheben; eine Fotoerkennung ersetzt keine Belegprüfung.",
    points: [
      "Fragen: „Wäre es für Sie hilfreich, Ihre tatsächlichen Kartenkosten anhand einer aktuellen Abrechnung mit den aktuellen SumUp-Konditionen zu vergleichen?“",
      "„Dürfen wir dafür eine möglichst geschwärzte Händlerabrechnung im geschützten Formular entgegennehmen?“ Die Abrechnung bleibt optional.",
      "Prüfen: Abrechnungszeitraum, tatsächlich abgerechnetes Kartenvolumen, Transaktionszahl, Gebührensumme, eventuelle Grundgebühren und Sonderkartentypen.",
      "„Welche Umsatzanteile entfallen auf Debit, Kredit, internationale oder geschäftliche Karten – soweit aus dem Beleg ersichtlich?“",
      "80/20 oder andere Systemvorgaben sind keine nachgewiesenen Kundendaten. Nicht erkennbare Felder als „Bitte prüfen“ markieren.",
      "Abschluss: „Ich prüfe zunächst Ihre Ist-Werte und zeige Ihnen anschließend einen nachvollziehbaren Vergleich. Erst nach Ihrer Prüfung erstellen wir ein Angebot.“"
    ]
  },
  {
    group: "Bedarfsermittlung", title: "Terminal, Mobilität, Beleg und Kasse",
    summary: "Die passende Gerätekategorie aus dem tatsächlichen Arbeitsablauf ableiten.",
    points: [
      "„Wo findet die Zahlung statt: fester Tresen, Tisch, Marktstand, Lieferdienst oder wechselnde Standorte?“",
      "„Soll das Gerät eigenständig arbeiten, oder steht ein Smartphone am Zahlungsplatz bereit?“",
      "„Benötigen Sie Papierbelege, digitale Belege oder beides?“",
      "„Wie viele Personen nehmen gleichzeitig Zahlungen an? Gibt es bereits eine Kasse, Artikelverwaltung oder Mitarbeiterrollen?“",
      "„Welche bestehende Hard- oder Software darf auf keinen Fall wegfallen?“ Integrationsfähigkeit vor einer Zusage prüfen.",
      "Zusammenfassen: „Wichtig sind also [Funktion 1] und [Funktion 2]; [bestehender Ablauf] soll erhalten bleiben. Habe ich etwas übersehen?“"
    ]
  },
  {
    group: "Einwandbehandlung", title: "„Wir haben schon ein Kartenterminal.“",
    summary: "Den Bestand respektieren und nur bei einem echten Bedarf vertiefen.",
    points: [
      "Bestätigen: „Das ist gut – eine funktionierende Lösung sollten Sie nicht ohne Grund wechseln.“",
      "Klärungsfrage: „Was gefällt Ihnen daran besonders, und gibt es etwas, das Sie heute einfacher oder transparenter haben möchten?“",
      "Bei Kosteninteresse: „Wenn Sie möchten, können wir die tatsächlichen Abrechnungskosten unverbindlich gegenüberstellen.“",
      "Bei fehlendem Bedarf: „Danke für die klare Rückmeldung. Dann lasse ich Sie im Tagesgeschäft weitermachen.“",
      "Nicht behaupten, dass SumUp grundsätzlich günstiger oder mit jeder Kasse kompatibel sei."
    ]
  },
  {
    group: "Einwandbehandlung", title: "„Zu teuer“ / „Ich möchte keine Grundgebühr.“",
    summary: "Die Kostenfrage in nachvollziehbare Bestandteile zerlegen.",
    points: [
      "Nachfragen: „Meinen Sie den einmaligen Gerätepreis, die laufende Grundgebühr oder die Gebühr je Kartenzahlung?“",
      "„Welcher Betrag ist für Sie aktuell der wichtigste Vergleichswert: monatliche Gesamtkosten oder Kosten pro Transaktion?“",
      "„Sollen wir beide Varianten anhand Ihres tatsächlichen Kartenmixes gegenüberstellen?“",
      "Vor einem Vergleich Transaktionsarten, Abrechnungsmonat, Fixkosten und aktuelle Vertragsbedingungen prüfen.",
      "Antwort nur mit überprüften Zahlen: „Für diesen geprüften Zeitraum ergibt sich [Betrag] – mit den genannten Annahmen. Ob das auch künftig zutrifft, hängt unter anderem von Umsatz und Kartenmix ab.“"
    ]
  },
  {
    group: "Einwandbehandlung", title: "„Keine Zeit“ / „Schicken Sie etwas per E-Mail.“",
    summary: "Das Gegenüber entlasten und eine konkrete, zulässige Folgeaktion vereinbaren.",
    points: [
      "Keine Zeit: „Verstanden. Passt ein kurzer Termin zu einer ruhigeren Uhrzeit besser, oder möchten Sie es dabei belassen?“",
      "E-Mail-Wunsch: „Gern. Geht es Ihnen eher um Gebühren, Terminalfunktionen oder die Kasse, damit ich nur passende Informationen zusammenstelle?“",
      "„An welche geschäftliche Adresse möchten Sie diese ausdrücklich angeforderten Unterlagen erhalten?“",
      "Nur den konkret gewünschten Inhalt versenden; keine allgemeinen Werbefolgen oder Newsletter daraus ableiten.",
      "Falls vereinbart: „Darf ich mich zu [Zeitpunkt] zu [konkret besprochenem Thema] nochmals melden?“ Absprache im CRM dokumentieren."
    ]
  },
  {
    group: "Einwandbehandlung", title: "„Ich bin zufrieden“ / „Kein Interesse.“",
    summary: "Einwand und klare Absage unterscheiden.",
    points: [
      "Zufriedenheit: „Das freut mich. Dann ist ein Wechsel gerade möglicherweise gar nicht nötig.“",
      "Optional eine einzige offene Frage: „Gibt es etwas, das Sie künftig ergänzen möchten, oder passt alles?“",
      "Bei „Kein Interesse“: „Verstanden, danke für Ihre Zeit. Ich wünsche Ihnen weiterhin einen guten Geschäftstag.“",
      "Klare Absage im HUNTER als „Kein Interesse“ dokumentieren und nicht ungefragt erneut kontaktieren.",
      "Die Ablehnung ist kein Signal für automatisches Nachfassen."
    ]
  },
  {
    group: "Einwandbehandlung", title: "„Ich muss darüber nachdenken / mit jemandem sprechen.“",
    summary: "Entscheidungsspielraum lassen und offene Sachfragen klären.",
    points: [
      "„Natürlich. Welche Frage müsste für Ihre Entscheidung noch geklärt sein?“",
      "„Wer sollte den Vergleich mit ansehen, und welche Angaben wären für diese Person wichtig?“",
      "Wenn es um Vertragslaufzeit, Auszahlung oder Hardware geht: die konkrete Frage notieren und anhand der aktuell verbindlichen Unterlagen beantworten.",
      "„Wenn es für Sie passt, können wir [Datum] die noch offenen Punkte gemeinsam durchgehen.“ Kein künstlicher Zeitdruck.",
      "Im CRM nur den vereinbarten Folgetermin hinterlegen."
    ]
  },
  {
    group: "Gesprächseinstieg", title: "Gespräch sauber abschließen",
    summary: "Jedes Gespräch endet mit einem verständlichen, dokumentierten Ergebnis.",
    points: [
      "Zusammenfassung: „Wir haben heute [Bedarf] und [offene Frage] geklärt. Ich übernehme als Nächstes [konkrete Aufgabe].“",
      "„Ist es für Sie in Ordnung, dass ich Ihnen [ausdrücklich gewünschtes Dokument] zukommen lasse?“",
      "„Passt [konkret vereinbarter Termin] für die Rückmeldung?“",
      "HUNTER-Status setzen: Interesse, Wiedervorlage, Kein Interesse oder in Kundenakte übernehmen.",
      "Keine automatische Zusage für einen Abschluss; Angebot und Terminbestätigung getrennt prüfen."
    ]
  },
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
        <a className="secondary" href="./testabrechnung.html" target="_blank" rel="noopener noreferrer">Testabrechnung öffnen und drucken</a>
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
