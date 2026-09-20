import { round } from "./calculations";
export type ExistingProviderInput = {
  volume: number;
  transactions: number;
  debitShare: number;
  debitRate: number;
  creditRate: number;
  serviceFee: number;
  terminalFee: number;
  perTransaction: number;
  confirmedTotal: number | null;
};
export type SumupPlan = "standard" | "plus";
export function compareFieldSales(input: ExistingProviderInput, plan: SumupPlan) {
  const values = [input.volume,input.transactions,input.debitShare,input.debitRate,input.creditRate,
    input.serviceFee,input.terminalFee,input.perTransaction];
  if (values.some(v=>!Number.isFinite(v)||v<0) || input.debitShare>100 || input.debitRate>100 ||
    input.creditRate>100 || !Number.isSafeInteger(input.transactions))
    throw Error("Bitte gültige Umsatz-, Gebühren-, Mix- und Transaktionswerte eingeben.");
  if (input.confirmedTotal !== null && (!Number.isFinite(input.confirmedTotal)||input.confirmedTotal<0))
    throw Error("Die geprüften Gesamtgebühren müssen gültig und nichtnegativ sein.");
  const debit = round(input.volume*input.debitShare/100);
  const credit = round(input.volume-debit);
  const variableOld = round(debit*input.debitRate/100+credit*input.creditRate/100);
  const fixedOld = round(input.serviceFee+input.terminalFee+input.transactions*input.perTransaction);
  const calculatedOld = round(variableOld+fixedOld);
  const oldTotal = input.confirmedTotal??calculatedOld;
  // Indicative German domestic in-person card rates; premium/Amex not eligible for Plus.
  const sumupDebit = plan==="plus"?0.79:1.39;
  const sumupCredit = 1.39;
  const sumupBase = plan==="plus"?19:0;
  const sumupVariable = round(debit*sumupDebit/100+credit*sumupCredit/100);
  const sumupTotal = round(sumupVariable+sumupBase);
  return {debit,credit,variableOld,fixedOld,calculatedOld,oldTotal,
    sumupDebit,sumupCredit,sumupBase,sumupVariable,sumupTotal,
    monthlyDifference:round(oldTotal-sumupTotal),
    annualDifference:round(12*(oldTotal-sumupTotal)),
    note:"Modellrechnung für vor Ort bezahlte, entsprechend klassifizierte Karten. Tatsächliche Kartentypen, Sonderkarten, Onlineumsatz und verbindliche SumUp-Konditionen vor Vertragsabschluss prüfen."
  };
}
