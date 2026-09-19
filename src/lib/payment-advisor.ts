import { solutions } from "./sumup";
export type HardwareNeeds = {
  smartphone: boolean;
  chip: boolean;
  standalone: boolean;
  paper: boolean;
  catalog: boolean;
  advancedPos: boolean;
  annual: boolean;
};
export const defaultNeeds: HardwareNeeds = {
  smartphone: false,
  chip: true,
  standalone: true,
  paper: false,
  catalog: false,
  advancedPos: false,
  annual: false,
};
export function recommendHardware(needs: HardwareNeeds) {
  const eligible = solutions
    .map((s, index) => ({ ...s, index }))
    .filter((s) => {
      if (s.index === 0)
        return (
          needs.smartphone &&
          !needs.chip &&
          !needs.standalone &&
          !needs.paper &&
          !needs.catalog
        );
      if (s.index === 1)
        return (
          needs.smartphone &&
          !needs.standalone &&
          !needs.paper &&
          !needs.catalog
        );
      if (s.index === 2) return !needs.paper && !needs.catalog;
      return true;
    })
    .sort((a, b) => a.price - b.price);
  return {
    best: eligible[0],
    alternatives: eligible.slice(1),
    reasons: [
      needs.paper
        ? "Integrierter Belegdruck erforderlich."
        : "Digitale Belege genügen.",
      needs.standalone || !needs.smartphone
        ? "Betrieb ohne Smartphone erforderlich."
        : "Kompatibles Smartphone bestätigt.",
      needs.chip
        ? "Chip-Kartenzahlungen berücksichtigen."
        : "Kontaktlose Zahlungen genügen.",
      ...(needs.catalog ? ["Artikel direkt am Terminal verwalten."] : []),
    ],
    warning: needs.advancedPos
      ? "Erweiterte Kasse, TSE, Raumpläne oder Integrationen separat prüfen. Ein vollständiges Kassensystem ist hier nicht eingepreist."
      : "",
  };
}
