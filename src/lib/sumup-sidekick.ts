import { hardwareCatalog } from "./sumup-sales";

export type SumupSidekickHardware = {id:string;name:string;price:number;description:string;illustration:string;discountEligible:boolean;group:"terminal"|"accessory"|"bundle";source:string};
export type SumupSidekickLicense = {id:string;name:string;price:number;period:"monthly"|"annual";description:string};
export type SumupSidekickFee = {domestic:number;other:number;online:number};
export type SumupSidekickSelection = {
  offerType:"carry"|"order"; hardware:{id:string;quantity:number}[];licenses:string[];
  campaignIndex:number|null;campaignAuthorized:boolean;domesticShare:number|null;domesticShareSource?:"estimate"|"documented"|"manual";onlineShare:number;
  payout:"three"|"daily"|"external";discount:number;
};
export const sumupSidekickHardware:SumupSidekickHardware[]=[
  ["tap","Tap to Pay",0,"Kontaktlose Zahlungen mit einem kompatiblen Smartphone, ohne separates Terminal.","phone",true,"terminal"],
  ["lite","Solo Lite",34,"Kompakter Kartenleser; zur Nutzung ist ein kompatibles Smartphone oder Tablet nötig.","lite",true,"terminal"],
  ["solo","Solo",79,"Eigenständiges mobiles Kartenterminal mit WLAN und integrierter SIM.","solo",true,"terminal"],
  ["terminal","Terminal",169,"Handliches Kassensystem mit integriertem Belegdrucker.","terminal",true,"terminal"],
  ["drawer","Kassenschublade 330A",69,"Bargeldschublade; Anschlussmöglichkeiten mit dem gewählten Bondrucker prüfen.","drawer",false,"accessory"],
  ["mpop","Star mPOP – Drucker & Kassenschublade",320,"Kombination aus Bondrucker und Kassenlade.","printer",false,"accessory"],
  ["epson","Epson TM-m30III Drucker (WiFi/Bluetooth)",229,"Stationärer Bondrucker für kompatible Kassenkonfigurationen.","printer",false,"accessory"],
  ["scanner","Barcode-Scanner NETUM C-750",59,"Artikel per Barcode erfassen; passende Softwarelizenz prüfen.","scanner",false,"accessory"],
  ["lan","RJ45 LAN-Kabel – 3 m",2.9,"Netzwerkkabel zum Anschluss kompatibler Hardware.","cable",false,"accessory"],
  ["soloprinter","Solo und Tresendrucker",109,"Solo-Kartenterminal mit stationärem Belegdrucker.","solo",true,"bundle"],
  ["solodock","Solo und Ladestation",79,"Eigenständiges Solo-Terminal inklusive Ladestation.","solo",true,"bundle"],
  ["pos","SumUp Kasse",399,"Stationäre SumUp-Kasse; Software und Zubehör passend zum Bedarf wählen.","pos",true,"terminal"],
  ["posprinter","SumUp Kasse und Bondrucker",549,"Stationärer Kassenplatz mit Drucker.","pos",true,"bundle"],
  ["posdual","SumUp Kasse mit zwei Bildschirmen, Drucker und Kassenschublade",599,"Kasse mit Kundendisplay, Belegdrucker und Bargeldschublade.","pos",true,"bundle"],
  ["posbundle","SumUp Kasse mit Drucker, Kassenschublade und Scanner",649,"Kassenbundle für Artikelverkauf, Bargeldannahme und Belegdruck.","pos",true,"bundle"],
  ["kdsdevice","SumUp KDS – TES 15 inch",249,"Küchenmonitor; KDS-Software ist separat zu prüfen.","kds",false,"accessory"]
].map(([id,name,price,description,illustration,discountEligible,group])=>({id:id as string,name:name as string,price:price as number,description:description as string,illustration:illustration as string,discountEligible:discountEligible as boolean,group:group as SumupSidekickHardware["group"],source:"SumUp Sidekick · Händleransicht · 21.09.2026"}));
export const sumupSidekickLicenses:SumupSidekickLicense[]=[
  {id:"posplus",name:"Kassensystem Plus",price:49,period:"monthly",description:"Erweiterte Kassensoftware inklusive zusätzlicher Kassen- und Servicefunktionen."},
  {id:"posannual",name:"Kassensystem Plus jährlich",price:588,period:"annual",description:"Ein Jahr Kassensystem Plus im Voraus; 49 € rechnerisch pro Monat, nicht zusätzlich zum Monatsabo."},
  {id:"payments",name:"Zahlungen Plus",price:19,period:"monthly",description:"Monatsabo mit reduzierten Gebühren für berechtigte EWR-Verbraucherkarten; andere Karten separat."},
  {id:"kds",name:"SumUp KDS",price:15,period:"monthly",description:"Software zur Bestellverwaltung auf einem Küchenmonitor."},
  {id:"beauty",name:"Beauty Plus",price:99,period:"monthly",description:"Salon- und Beauty-Zusatzlösung; Funktionsumfang im Sidekick prüfen."}
];
export const sumupSidekickFees:SumupSidekickFee[]=[
  {domestic:1.39,other:1.39,online:2.5},
  {domestic:1.29,other:1.99,online:2.5},
  {domestic:1.19,other:1.99,online:2.5},
  {domestic:1.05,other:1.99,online:2.5},
  {domestic:.89,other:1.99,online:2.5},
  {domestic:.85,other:1.99,online:2.5}
];
export const sumupPlusIds=["posplus","posannual","payments","beauty"] as const;
export function normalizeSidekickSelection(selection:SumupSidekickSelection,chosen?:string):SumupSidekickSelection{
 const ids=[...new Set(selection.licenses)];
 const primary=chosen&&sumupPlusIds.some(id=>id===chosen)?chosen:ids.find(id=>sumupPlusIds.some(p=>p===id));
 const licenses=ids.filter(id=>!sumupPlusIds.some(p=>p===id)||id===primary);
 return {...selection,licenses};
}
export function chooseSidekickLicense(selection:SumupSidekickSelection,id:string):SumupSidekickSelection{
 const exists=selection.licenses.includes(id);
 return normalizeSidekickSelection({...selection,licenses:exists?selection.licenses.filter(x=>x!==id):[...selection.licenses,id]},exists?undefined:id);
}
export const emptySidekickSelection:SumupSidekickSelection={
  offerType:"order",hardware:[],licenses:[],campaignIndex:null,campaignAuthorized:false,
  domesticShare:null,domesticShareSource:undefined,onlineShare:0,payout:"daily",discount:0
};
export function sidekickHardwareNet(selection:SumupSidekickSelection):number{
  if(selection.discount<0||selection.discount>25||!Number.isFinite(selection.discount))throw Error("Rabatt muss zwischen 0 und 25 % liegen.");
  return Math.round(selection.hardware.reduce((sum,item)=>{
    const product=sumupSidekickHardware.find(p=>p.id===item.id);
    if(!product||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>20)throw Error("Ungültige Hardwareauswahl.");
    return sum+product.price*item.quantity*(product.discountEligible?1-selection.discount/100:1);
  },0)*100)/100;
}
export function sidekickLicenseMonthly(selection:SumupSidekickSelection):number{
  if(selection.licenses.filter(id=>sumupPlusIds.some(x=>x===id)).length>1)throw Error("Es darf nur eine Plus-Variante ausgewählt werden.");
  return sumupSidekickLicenses.filter(l=>selection.licenses.includes(l.id)).reduce((sum,l)=>sum+l.price/(l.period==="annual"?12:1),0);
}
export function sidekickScenario(monthlyVolume:number,selection:SumupSidekickSelection):number|null{
  const fee=selection.campaignIndex===null?null:sumupSidekickFees[selection.campaignIndex];
  if(!fee||selection.domesticShare===null||!Number.isFinite(monthlyVolume)||monthlyVolume<0)return null;
  const domesticShare=selection.domesticShare,onlineShare=selection.onlineShare;
  if(![domesticShare,onlineShare].every(x=>Number.isFinite(x)&&x>=0&&x<=100))throw Error("Kartenanteile zwischen 0 und 100 % eingeben.");
  const online=monthlyVolume*onlineShare/100,present=monthlyVolume-online,domestic=present*domesticShare/100;
  return Math.round((domestic*fee.domestic/100+(present-domestic)*fee.other/100+online*fee.online/100+sidekickLicenseMonthly(selection))*100)/100;
}
export function sidekickNotes(selection:SumupSidekickSelection):string{
  const fee=selection.campaignIndex===null?null:sumupSidekickFees[selection.campaignIndex];
  return [
    "Sidekick-Konfiguration als neXaro-Beratungsentwurf – kein automatisch übermitteltes SumUp-Angebot.",
    "Angebotsart: "+(selection.offerType==="carry"?"Carry & Sell":"Order & Sell"),
    "Auszahlung: "+({three:"SumUp Konto · 3 Stunden",daily:"SumUp Konto · täglich",external:"Externes Konto · 3–5 Tage (Sidekick)"}[selection.payout]),
    "Kondition: "+(fee?fee.domestic.toFixed(2)+" % Domestic, "+fee.other.toFixed(2)+" % Sonderkarten, "+fee.online.toFixed(2)+" % Karte nicht anwesend":"öffentliche SumUp-Konditionen gesondert prüfen"),
    "Individuelle Kondition für diesen Händler freigegeben: "+(selection.campaignAuthorized?"manuell bestätigt":"NEIN – NICHT ALS VERBINDLICH ZUSAGEN"),
    "Kartenmix Domestic: "+(selection.domesticShare===null?"unbekannt":selection.domesticShare+" % des Vor-Ort-Umsatzes"),
    "Eigener Hardware-Rabatt: "+selection.discount+" % nur auf rabattfähige Geräte"
  ].join("\n");
}
export function sidekickOfferLines(selection:SumupSidekickSelection){
  sidekickLicenseMonthly(selection);
  const lines=selection.hardware.map(item=>{
    const product=sumupSidekickHardware.find(p=>p.id===item.id);
    if(!product)throw Error("Unbekanntes Hardwareprodukt.");
    return {name:"SumUp "+product.name+" · Hardware",quantity:item.quantity,price:Math.round(product.price*(product.discountEligible?1-selection.discount/100:1)*100)/100,vat:19};
  });
  for(const id of selection.licenses){
    const license=sumupSidekickLicenses.find(l=>l.id===id);
    if(!license)throw Error("Unbekannte Lizenz.");
    lines.push({name:"SumUp "+license.name+" · "+(license.period==="annual"?"Jahreslizenz":"Monatslizenz"),quantity:1,price:license.price,vat:19});
  }
  return lines;
}
export const sidekickCatalogSource="SumUp Sidekick · Nutzer-Screenshots vom 21.09.2026; reguläre Netto-Referenzpreise, keine Aktionspreise";
