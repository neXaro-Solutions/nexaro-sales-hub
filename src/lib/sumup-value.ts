import type {SumupSidekickSelection} from "./sumup-sidekick";

/** Only describe capabilities in the actual selection; do not claim the incumbent lacks them. */
export function sumupValueHighlights(selection?:SumupSidekickSelection,noFixedTerm=false):string[]{
 const labels:string[]=[];
 const license=new Set(selection?.licenses||[]);
 const hardware=new Set((selection?.hardware||[]).filter(x=>x.quantity>0).map(x=>x.id));
 if(license.has("posplus")||license.has("posannual"))labels.push("Kassen- und Artikelverwaltung mit Kassensystem Plus");
 if(license.has("kds"))labels.push("Bestellungen auf dem Küchenmonitor mit SumUp KDS");
 if(license.has("beauty"))labels.push("Beauty-/Salonsoftware; konkreten Funktionsumfang prüfen");
 if(license.has("payments"))labels.push("Zahlungen Plus mit Konditionen für berechtigte Karten");
 if(["pos","posprinter","posdual","posbundle"].some(id=>hardware.has(id)))labels.push("Stationärer Kassenplatz");
 if(["terminal","posprinter","posdual","posbundle","soloprinter","mpop","epson"].some(id=>hardware.has(id)))labels.push("Belegdruck mit ausgewählter Hardware");
 if(["posbundle","scanner"].some(id=>hardware.has(id)))labels.push("Artikel per Barcode erfassen");
 if(["posbundle","posdual","drawer","mpop"].some(id=>hardware.has(id)))labels.push("Kassenschublade für Bargeld");
 if(["terminal","solo","soloprinter","solodock"].some(id=>hardware.has(id)))labels.push("Eigenständig nutzbares Kartenterminal");
 if(hardware.has("lite"))labels.push("Kompakter Kartenleser für Smartphone oder Tablet");
 if(hardware.has("tap"))labels.push("Kartenzahlung per kompatiblem Smartphone ohne Zusatzterminal");
 if(hardware.has("kdsdevice"))labels.push("Küchenmonitor als Hardware");
 if(selection?.payout==="three")labels.push("Auszahlungsoption alle drei Stunden über SumUp Geschäftskonto");
 else if(selection?.payout==="daily")labels.push("Tägliche Auszahlung über SumUp Geschäftskonto");
 if(noFixedTerm)labels.push("Keine gewünschte feste Vertragslaufzeit im Standard-Zahlungsmodell");
 return [...new Set(labels)].slice(0,7);
}
