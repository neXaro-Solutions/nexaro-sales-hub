/** Verkaufskalkulation mit echter Marge statt Aufschlag; netto je freigegebener Einheit. */
export function vapeSaleNet(purchaseNet: number, marginPercent: number): number {
  if (!Number.isFinite(purchaseNet) || purchaseNet <= 0 ||
      !Number.isFinite(marginPercent) || marginPercent < 15 || marginPercent > 25) {
    throw new Error("Es wird ein positiver EK netto und eine Marge zwischen 15 und 25 % benötigt.");
  }
  return Math.ceil((purchaseNet / (1 - marginPercent / 100)) * 100 - 0.00000001) / 100;
}
export function vapeSaleGross(saleNet: number): number {
  return Math.round((saleNet * 1.19 + Number.EPSILON) * 100) / 100;
}

/** Rechnerischer Einzelwert aus einem freigegebenen VE-VK; KEINE Einzelstück-Verkaufsfreigabe. */
export function vapeIndicativePieceNet(veSaleNet: number, piecesPerVe: number): number {
  if (!Number.isFinite(veSaleNet) || veSaleNet <= 0 ||
      !Number.isSafeInteger(piecesPerVe) || piecesPerVe <= 0) {
    throw new Error("Stückpreis benötigt einen positiven VE-VK und eine bestätigte VE-Stückzahl.");
  }
  return Math.round((veSaleNet / piecesPerVe + Number.EPSILON) * 100) / 100;
}
