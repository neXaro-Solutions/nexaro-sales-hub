(()=>{
"use strict";
const KEY="nexaro-language";
const q=new URLSearchParams(location.search);
let language=(q.get("lang")||localStorage.getItem(KEY)||"de").toLowerCase()==="en"?"en":"de";
const original=new WeakMap();let applying=false;

const exact=new Map(Object.entries({
"Übersicht":"Overview","Kunden & Leads":"Customers & Leads","Außendienst · HUNTER":"Field Sales · HUNTER","Telefonleads":"Phone Leads","Kalender":"Calendar","SumUp":"SumUp","Vape":"Vape","Software-Vertrieb":"Software Sales","Angebote & Rechnungen":"Offers & Invoices","Vertriebswissen":"Sales Knowledge","Aufgaben":"Tasks","System & Sicherung":"System & Security",
"Zur Übersicht":"Back to overview","Demo":"Demo","Demo-Modus":"Demo mode","Demo verlassen":"Exit demo","Zur Anmeldung":"Go to login","Online":"Online","Offline":"Offline",
"DEMO":"DEMO","Fiktive Beispieldaten · Änderungen werden nicht dauerhaft gespeichert.":"Fictional sample data · Changes are not stored permanently.",
"neXaro CRM":"neXaro CRM","Starke Marken.\nStarke Standorte.":"Strong brands.\nStrong locations.","Dein geschützter Vertriebsbereich":"Your protected sales workspace",
"Neuer Kunde":"New customer","Neue Aufgabe":"New task","Termin anlegen":"Create appointment","Call Hunter":"Call Hunter","Angebote":"Offers",
"Heute":"Today","Diese Woche":"This week","Offen":"Open","Erledigt":"Completed","Neu":"New","Kontaktiert":"Contacted","Termin":"Appointment","Angebot":"Offer","Gewonnen":"Won","Verloren":"Lost",
"Speichern":"Save","Abbrechen":"Cancel","Schließen":"Close","Bearbeiten":"Edit","Löschen":"Delete","Suchen":"Search","Filter":"Filter","Aktualisieren":"Refresh","Zurück":"Back","Weiter":"Next","Öffnen":"Open","Hinzufügen":"Add","Auswählen":"Select",
"Unternehmen":"Company","Ansprechpartner":"Contact person","Telefon":"Phone","E-Mail":"Email","Website":"Website","Adresse":"Address","Ort":"City","Branche":"Industry","Notizen":"Notes","Status":"Status","Quelle":"Source","Umsatz":"Revenue","Gebühren":"Fees",
"Rückruf":"Callback","Wiedervorlage":"Follow-up","Im Kalender anlegen":"Add to calendar","Infos senden":"Send information","Kein Interesse":"Not interested","Kontakt nicht verfügbar / Nummer nicht vergeben":"Contact unavailable / number invalid",
"📞 Telefonleads":"📞 Phone Leads","Call-Modus starten":"Start Call Mode","Call-Modus schließen":"Close Call Mode","Arbeitsliste":"Work queue","Keine offenen Telefonleads":"No open phone leads",
"Automatischer Rundgang":"Automatic tour","Jetzt selbst erkunden →":"Explore on your own →","Jetzt bist du dran.":"Now it’s your turn.","DEMO ABGESCHLOSSEN":"DEMO COMPLETE",
"INTERAKTIVE PRODUCT EXPERIENCE":"INTERACTIVE PRODUCT EXPERIENCE","Demo Experience starten":"Start Demo Experience","Ohne Rundgang frei erkunden":"Explore freely without tour",
"10 automatische Szenen":"10 automatic scenes","echte Demo-Daten":"real demo data","ca. 90 Sekunden":"approx. 90 seconds",
"DEIN ARBEITSTAG":"YOUR WORKDAY","KUNDEN & LEADS":"CUSTOMERS & LEADS","FIELD HUNTER":"FIELD HUNTER","CALL HUNTER":"CALL HUNTER","TERMINE":"APPOINTMENTS","SUMUP VERTRIEBSSTUDIO":"SUMUP SALES STUDIO","CRM SOFTWARE":"CRM SOFTWARE","ANGEBOT & FOLLOW-UP":"OFFER & FOLLOW-UP","VERTRIEBSWISSEN":"SALES KNOWLEDGE","DEIN NÄCHSTER SCHRITT":"YOUR NEXT STEP",
"Alles Wichtige beginnt an einem Ort.":"Everything important starts in one place.","Aus Kontakten werden strukturierte Chancen.":"Turn contacts into structured opportunities.","Neue Standorte finden. Tour planen. Vor Ort entscheiden.":"Find new locations. Plan routes. Decide on site.","Telefonakquise ohne Listen-Chaos.":"Phone prospecting without list chaos.","Dein Außendienst bleibt verbindlich.":"Keep field sales reliable.","Vom Erstbedarf zum nachvollziehbaren Payment-Angebot.":"From initial need to a transparent payment offer.","Auch Software-Anfragen bleiben im selben Vertriebsprozess.":"Software enquiries stay in the same sales process.","Der nächste Schritt bleibt im System.":"The next step stays in the system.","Auch im Kundengespräch hast du Unterstützung dabei.":"Support is available during customer conversations too.","Ein Sales Hub, der Akquise und Abschluss verbindet.":"A Sales Hub that connects prospecting and closing.",
"Sofort wissen, was heute wirklich zählt.":"Know immediately what really matters today.","Keine Zettelwirtschaft. Kein Informationsverlust.":"No paper chaos. No loss of information.","Mehr Besuche mit weniger Umwegen und weniger Nacharbeit.":"More visits with fewer detours and less follow-up work.","Ein Lead. Ein Gespräch. Eine klare nächste Aktion.":"One lead. One conversation. One clear next action.","Weniger vergessene Rückrufe. Mehr Verbindlichkeit.":"Fewer forgotten callbacks. More reliability.","Beratung wird nachvollziehbar statt improvisiert.":"Consulting becomes transparent instead of improvised.","Payment, Außendienst und CRM-Vertrieb in einem Hub.":"Payment, field sales and CRM sales in one hub.","Vom Angebot bis zur Nachverfolgung bleibt alles verbunden.":"Everything stays connected from offer to follow-up.","Nicht nur verwalten. Sicherer und strukturierter verkaufen.":"Do more than manage. Sell with more confidence and structure.","Mehr Übersicht. Mehr Konsequenz. Weniger Aufwand.":"More visibility. More consistency. Less effort.",
"Ich nutze bereits Kartenzahlung":"I already accept card payments","Ich nutze noch keine Kartenzahlung":"I do not accept card payments yet","Bestehende Lösung vergleichen →":"Compare existing solution →","Kosten & Lösung berechnen →":"Calculate costs & solution →","BESTANDSVERGLEICH":"EXISTING SOLUTION","NEUEINSTIEG":"NEW TO CARD PAYMENTS",
"Wie nimmt der Kunde heute Zahlungen an?":"How does the customer accept payments today?","Bestand speichern":"Save current setup","Vergleichsangebot":"Comparison offer","Ist-Bestand":"Current setup","Foto-Import":"Photo import","Kartenmix & Gebühren":"Card mix & fees",
"Software-Vertrieb ohne Medienbruch.":"Software sales without switching tools.","Ein Lead. Ein Gespräch. Eine Entscheidung.":"One lead. One conversation. One decision.",
"Neuer Kunde anlegen":"Create new customer","Neue Aufgabe anlegen":"Create new task","Dein Arbeitsbereich wird geladen …":"Loading your workspace …",
"Menü öffnen":"Open menu","Menü schließen":"Close menu","Zur Dashboard-Übersicht":"Back to dashboard overview"
}));

const phrases=[
["Termine, offene Aufgaben, neue Anfragen und Vertriebskennzahlen liegen direkt vor dir – ohne zwischen Listen springen zu müssen.","Appointments, open tasks, new enquiries and sales metrics are right in front of you – without jumping between lists."],
["Kundenakte, Gesprächsnotizen, Termine, Dokumente und Verkaufsstatus laufen in einer zentralen Sicht zusammen.","Customer record, conversation notes, appointments, documents and sales status come together in one central view."],
["Der HUNTER verbindet Recherche, Merkliste und Touren in einem Arbeitsbereich. Kontakte können direkt übernommen, abgelehnt oder weiterbearbeitet werden.","HUNTER combines research, shortlist and routes in one workspace. Contacts can be accepted, rejected or processed further directly."],
["Eine fokussierte 10er-Arbeitsliste führt dich Kontakt für Kontakt durch Gesprächseinstieg, Anruf, Info-Freigabe, Rückruf und Termin.","A focused 10-lead work queue guides you contact by contact through the opener, call, information permission, callback and appointment."],
["Termine, Rückrufe und Wiedervorlagen sind zentral sichtbar und direkt mit der Kundenakte verknüpft.","Appointments, callbacks and follow-ups are visible centrally and linked directly to the customer record."],
["Ob neue Kartenzahlung oder bestehende Lösung: Bedarf, Hardware, Gebühren und Abrechnung werden strukturiert aufgenommen und sauber dokumentiert.","Whether new to card payments or using an existing solution: needs, hardware, fees and statements are captured systematically and documented clearly."],
["Interessenten, Projektbedarf, Wiedervorlagen und Demo-Einladungen werden strukturiert bearbeitet und mit der zentralen Kundenakte verbunden.","Prospects, project requirements, follow-ups and demo invitations are processed systematically and connected to the central customer record."],
["Angebote, Rechnungen und Nachfassaktionen greifen ineinander. So endet der Prozess nicht beim PDF.","Offers, invoices and follow-up actions work together, so the process does not end with the PDF."],
["Gesprächseinstieg, Bedarfsermittlung und Einwandbehandlung sind direkt im CRM abrufbar – mobil und durchsuchbar.","Conversation openers, needs analysis and objection handling are available directly in the CRM – mobile and searchable."],
["Von der Recherche und Telefonakquise über Termine und Beratung bis zum Angebot und Follow-up entsteht ein durchgängiger Vertriebsprozess.","From research and phone prospecting through appointments and consulting to offers and follow-up, one continuous sales process emerges."],
["Wir zeigen dir die wichtigsten Schnellaktionen für deinen Arbeitstag.","We show you the most important quick actions for your workday."],
["Die Demo führt dich durch die zentrale Kunden- und Lead-Struktur.","The demo guides you through the central customer and lead structure."],
["Als Nächstes siehst du, wie Recherche, Merkliste und Touren zusammenspielen.","Next, you’ll see how research, shortlist and routes work together."],
["Jetzt siehst du den Call Hunter mit fokussierter Arbeitsliste und klaren Folgeaktionen.","Now you’ll see Call Hunter with a focused work queue and clear next actions."],
["Die Demo zeigt dir Termine, Rückrufe und Wiedervorlagen im Zusammenhang.","The demo shows appointments, callbacks and follow-ups in context."],
["Wir zeigen dir den strukturierten Weg von Bedarf und Ist-Situation zum Payment-Angebot.","We show you the structured path from needs and current situation to a payment offer."],
["Die Beispielanfrage zeigt den durchgängigen Software-Vertriebsprozess.","The sample enquiry shows the continuous software sales process."],
["Du siehst, wie Angebot, Rechnung und Follow-up miteinander verbunden bleiben.","You’ll see how offers, invoices and follow-up remain connected."],
["Zum Abschluss zeigen wir dir die Unterstützung direkt im Kundengespräch.","Finally, we show you the support available directly during the customer conversation."],
["Der geführte Rundgang endet gleich. Danach kannst du alles selbst ausprobieren.","The guided tour is about to end. After that, you can try everything yourself."],
["Du hast den neXaro Sales Hub einmal vollständig gesehen. Ab jetzt kannst du die Demo frei öffnen, klicken und alle Bereiche selbst ausprobieren.","You have now seen the complete neXaro Sales Hub. From here, you can freely open, click and try every area yourself."],
["Alle Daten sind fiktiv. Deine Änderungen bleiben ausschließlich in dieser Demo-Sitzung.","All data is fictional. Your changes remain only in this demo session."],
["Demo-Modus: fiktive Telefonleads · E-Mails, Funnel und Statusänderungen werden ausschließlich simuliert.","Demo mode: fictional phone leads · emails, funnels and status changes are simulated only."],
["Wie nimmt der Kunde heute Zahlungen an?","How does the customer accept payments today?"],
["Die Auswahl entscheidet bewusst über zwei unterschiedliche Logiken: Bestandsvergleich oder Neueinstieg-Kalkulation.","This selection deliberately chooses between two different flows: existing-solution comparison or new-to-card-payments calculation."]
];

function translateString(value){
 if(!value||!value.trim())return value;
 const t=value.trim();if(exact.has(t))return value.replace(t,exact.get(t));
 let out=value;for(const [de,en] of phrases){if(out.includes(de))out=out.split(de).join(en);}return out;
}
function restoreText(n){if(original.has(n)){n.nodeValue=original.get(n);original.delete(n);}}
function applyText(n){
 if(n.parentElement?.closest("script,style,noscript,code,pre"))return;
 if(language==="de"){restoreText(n);return;}
 const src=original.get(n)??n.nodeValue;if(!original.has(n))original.set(n,src);
 const v=translateString(src);if(v!==n.nodeValue)n.nodeValue=v;
}
function applyEl(el){
 for(const attr of ["placeholder","aria-label","title"]){
  const k="nxOrig"+attr.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  if(language==="de"){if(el.dataset?.[k]){el.setAttribute(attr,el.dataset[k]);delete el.dataset[k];}continue;}
  const v=el.getAttribute?.(attr);if(!v)continue;if(!el.dataset[k])el.dataset[k]=v;el.setAttribute(attr,translateString(el.dataset[k]));
 }
}
function walk(root=document.body){
 if(!root)return;applying=true;
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))applyText(n);
 root.querySelectorAll?.("*").forEach(applyEl);document.documentElement.lang=language;applying=false;
}
function setLanguage(next){
 language=next==="en"?"en":"de";localStorage.setItem(KEY,language);document.documentElement.lang=language;
 document.querySelectorAll("[data-nx-lang]").forEach(b=>{b.textContent=language==="de"?"EN":"DE";b.setAttribute("aria-label",language==="de"?"Switch to English":"Auf Deutsch umstellen");});
 walk();window.dispatchEvent(new CustomEvent("nx-language-change",{detail:{language}}));
}
function installToggle(){
 if(document.querySelector("[data-nx-lang]"))return;
 const b=document.createElement("button");b.type="button";b.dataset.nxLang="1";b.className="nx-language-toggle";
 b.textContent=language==="de"?"EN":"DE";b.setAttribute("aria-label",language==="de"?"Switch to English":"Auf Deutsch umstellen");
 b.addEventListener("click",()=>setLanguage(language==="de"?"en":"de"));
 const host=document.querySelector(".topbar-right")||document.body;host.appendChild(b);
 const st=document.createElement("style");st.textContent=`
 .nx-language-toggle{display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:34px;padding:0 10px;border:1px solid #cfdcc8;border-radius:999px;background:#fff;color:#243522;font:inherit;font-size:11px;font-weight:900;letter-spacing:.08em;cursor:pointer;box-shadow:0 6px 18px rgba(35,55,28,.08);z-index:9300}
 .nx-language-toggle:hover{border-color:#9fc970;background:#f5fbea}
 body>.nx-language-toggle{position:fixed;right:14px;top:14px}
 @media(max-width:700px){.topbar-right .nx-language-toggle{min-width:38px;height:32px;padding:0 8px}}
 `;document.head.appendChild(st);
}
const observer=new MutationObserver(muts=>{if(applying)return;for(const m of muts){for(const node of m.addedNodes){if(node.nodeType===Node.TEXT_NODE)applyText(node);else if(node.nodeType===Node.ELEMENT_NODE){applyEl(node);walk(node);}}}});
function boot(){installToggle();walk();observer.observe(document.body,{subtree:true,childList:true});}
window.neXaroLanguage={get:()=>language,set:setLanguage};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();