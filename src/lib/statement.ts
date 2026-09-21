import { finite, round, type PaymentInput } from "./calculations";
export type StatementField =
  | "volume"
  | "onlineVolume"
  | "transactions"
  | "costs";
export const statementLabels: Record<StatementField, string> = {
  volume: "Kartenumsatz vor Ort (€)",
  onlineVolume: "Online-Umsatz (€)",
  transactions: "Anzahl Transaktionen",
  costs: "Vergleichbare Gesamtkosten netto (€)",
};
export type StatementCandidate = { value: number; evidence: string };
// Deliberately conservative: ambiguous totals remain a choice, not a silent sum.
export function extractStatement(text: string) {
  if (text.length > 100000)
    throw Error("Zu viel Text. Bitte eine Abrechnung je Vorgang erfassen.");
  const candidates: Record<StatementField, StatementCandidate[]> = {
    volume: [],
    onlineVolume: [],
    transactions: [],
    costs: [],
  };
  const patterns: Record<StatementField, RegExp> = {
    volume: /(?:karten[-\s]?umsatz(?:\s+(?:vor\s+ort|gesamt|im\s+monat))?|umsatz\s+(?:vor\s+ort|kartenzahlungen|gesamt)|präsenzumsatz|gesamtumsatz|transaktionsvolumen|kartenzahlungsvolumen)/i,
    onlineVolume: /(?:online[-\s]?umsatz|umsatz\s+online)/i,
    transactions: /(?:anzahl\s*(?:der\s*)?(?:karten[-\s]?)?(?:transaktionen|zahlungen)|(?:karten[-\s]?)?transaktionen\s*(?:gesamt|anzahl)?)/i,
    costs: /(?:gesamt[-\s]?(?:kosten|gebühren)(?:\s+netto)?|(?:kosten|gebühren)\s+(?:gesamt|pro\s+monat)(?:\s+netto)?|summe\s+(?:der\s+)?(?:entgelte|gebühren)(?:\s+netto)?|rechnungsbetrag\s+netto)/i,
  };
  for (const line of text
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)) {
    for (const key of Object.keys(patterns) as StatementField[]) {
      const match = patterns[key].exec(line);
      if (!match || (key === "volume" && /online/i.test(line))) continue;
      const tail = line.slice(match.index + match[0].length);
      if (
        /[-−]\s*\d/.test(tail) ||
        (key === "transactions" && /%|\d[./-]\d{1,2}[./-]\d/.test(tail))
      )
        continue;
      // German money format only. Do not confuse percentages, dates or IDs with amounts.
      const tokens =
        key === "transactions"
          ? tail.match(
              /(?<![\d.,])\d{1,3}(?:\.\d{3})+(?![\d.,])|(?<![\d.,])\d+(?![\d.,])/g,
            )
          : tail.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)|-?\d+,\d{2}(?!\d)/g);
      if (!tokens?.length || (key !== "transactions" && /%/.test(tail)))
        continue;
      for (const token of tokens) {
        const value = Number(token.replace(/\./g, "").replace(",", "."));
        if (
          value >= 0 &&
          value <= 1e9 &&
          !candidates[key].some((c) => c.value === value)
        )
          candidates[key].push({ value, evidence: line });
      }
    }
  }
  return candidates;
}
export function normalizeStatement(
  values: Record<StatementField, string>,
  months: number,
): Pick<
  PaymentInput,
  "volume" | "onlineVolume" | "transactions" | "currentTotal"
> {
  finite(months, "Abrechnungsmonate", 0.05, 24);
  const parsed = Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      if (!value.trim())
        throw Error(
          `${statementLabels[key as StatementField]}: Wert prüfen und ergänzen; wenn nicht vorhanden, ausdrücklich 0 eintragen.`,
        );
      return [
        key,
        finite(Number(value), statementLabels[key as StatementField]),
      ];
    }),
  ) as Record<StatementField, number>;
  if (!Number.isInteger(parsed.transactions))
    throw Error("Die Transaktionsanzahl des Belegs muss ganzzahlig sein.");
  if (parsed.volume + parsed.onlineVolume <= 0)
    throw Error(
      "Für einen Vergleich ist ein positiver Zahlungsumsatz erforderlich.",
    );
  return {
    volume: round(parsed.volume / months),
    onlineVolume: round(parsed.onlineVolume / months),
    transactions: round(parsed.transactions / months),
    currentTotal: round(parsed.costs / months),
  };
}

/** Pass only uniquely recognized fields to Ist-Bestand. No implicit zeroes or confirmation. */
export function recognizedStatementValues(text: string) {
  const candidates = extractStatement(text);
  const values: Partial<Pick<PaymentInput, "volume" | "onlineVolume" | "transactions" | "currentTotal">> = {};
  if (candidates.volume.length === 1) values.volume = candidates.volume[0].value;
  if (candidates.onlineVolume.length === 1) values.onlineVolume = candidates.onlineVolume[0].value;
  if (candidates.transactions.length === 1 &&
      Number.isSafeInteger(candidates.transactions[0].value))
    values.transactions = candidates.transactions[0].value;
  if (candidates.costs.length === 1) values.currentTotal = candidates.costs[0].value;
  return values;
}
