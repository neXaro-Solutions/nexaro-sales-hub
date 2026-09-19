export const pricingSource = "https://www.sumup.com/de-de/preise/";
export const hardwareSource = "https://www.sumup.com/de-de/kartenterminals/";
export const checkedAt = "2026-09-19";
// Versioned public reference prices. Never silently scrape/overwrite offer snapshots.
export const solutions = [
  {
    name: "Tap to Pay",
    price: 0,
    regular: 0,
    tag: "Direkt startklar",
    use: "Kontaktlose Zahlungen auf einem kompatiblen Smartphone.",
    connection: "Smartphone & Internet",
    receipt: "Digital",
    url: "https://www.sumup.com/de-de/tap-to-pay/",
  },
  {
    name: "Solo Lite",
    price: 22,
    regular: 34,
    tag: "Kompakter Einstieg",
    use: "Kartenterminal in Verbindung mit der SumUp App.",
    connection: "Smartphone erforderlich",
    receipt: "Digital",
    url: hardwareSource,
  },
  {
    name: "Solo",
    price: 59,
    regular: 79,
    tag: "Mobil & eigenständig",
    use: "Eigenständiges Terminal mit Touchscreen, WLAN und SIM.",
    connection: "WLAN / integrierte SIM",
    receipt: "Digital, Drucker optional",
    url: "https://www.sumup.com/de-de/solo-kartenlesegeraet/",
  },
  {
    name: "Terminal",
    price: 139,
    regular: 169,
    tag: "Verkaufen & kassieren",
    use: "Handliches Kassensystem mit integriertem Belegdruck.",
    connection: "Eigenständiges Gerät",
    receipt: "Integrierter Drucker",
    url: hardwareSource,
  },
];
export const guide = [
  {
    title: "Einstieg",
    prompt: "„Wie zufrieden sind Sie aktuell mit Ihren Kartenzahlungen?“",
    fields:
      "Ansprechpartner, Zeit für ein Gespräch und nächster sinnvoller Schritt.",
  },
  {
    title: "Ist-Situation",
    prompt:
      "„Welchen Anbieter nutzen Sie, wie viel Kartenumsatz haben Sie und welche Kosten stehen auf Ihrer Abrechnung?“",
    fields:
      "Umsatz, Kartenmix, Transaktionen, Grundgebühr und Stückkosten erfassen.",
  },
  {
    title: "Bedarf",
    prompt:
      "„Was sollte beim Kassieren einfacher werden: Mobilität, Belege, Bedienung oder Kosten?“",
    fields:
      "Smartphone vorhanden? Eigenständiges Gerät? Drucker? Kassenfunktionen?",
  },
  {
    title: "Vergleich",
    prompt:
      "„Lassen Sie uns die Gesamtkosten mit Ihren tatsächlichen Zahlen vergleichen.“",
    fields:
      "Gebühren, Hardware und mögliche Einsparung erläutern; individuelle Konditionen offenlassen.",
  },
  {
    title: "Einwände",
    prompt:
      "„Was müsste geklärt sein, damit die Lösung für Ihren Standort passt?“",
    fields:
      "Vertragslaufzeit, Kündigung, Kartentypen und aktuelle Konditionen prüfen.",
  },
  {
    title: "Nächster Schritt",
    prompt:
      "„Wollen wir eine konkrete Lösung festhalten und einen Folgetermin vereinbaren?“",
    fields:
      "Gespräch dokumentieren, Angebot erstellen und Wiedervorlage festlegen.",
  },
];
