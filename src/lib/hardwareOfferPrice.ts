import { round } from "./calculations";
/** A user-granted discount on regular SumUp hardware; not a supplier promotion. */
export function hardwareOfferPrice(regularUnit: number, percent: number, quantity = 1) {
  if (![regularUnit,percent,quantity].every(Number.isFinite) ||
      regularUnit < 0 || percent < 0 || percent > 25 ||
      !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100)
    throw Error("Hardwarepreis, Rabatt (0–25 %) und Menge prüfen.");
  const discountedUnit = round(regularUnit*(1-percent/100));
  return {
    regularUnit, percent, discountedUnit, quantity,
    regularTotal:round(regularUnit*quantity),
    discountTotal:round((regularUnit-discountedUnit)*quantity),
    offerNet:round(discountedUnit*quantity),
  };
}
