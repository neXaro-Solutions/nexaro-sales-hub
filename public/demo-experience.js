(()=>{
  "use strict";
  const params=new URLSearchParams(location.search);
  if(params.get("demo")!=="1")return;
  if(navigator.webdriver)return;

  const scenes=[
    {page:"Übersicht",eyebrow:"01 · DEIN ARBEITSTAG",title:"Alles Wichtige beginnt an einem Ort.",copy:"Termine, offene Aufgaben, neue Anfragen und Vertriebskennzahlen liegen direkt vor dir – ohne zwischen Listen springen zu müssen.",benefit:"Sofort wissen, was heute wirklich zählt.",target:".nx-dashboard-shortcuts",action:"Klicke gern auf eine der Schnellaktionen."},
    {page:"Kunden & Leads",eyebrow:"02 · KUNDEN & LEADS",title:"Aus Kontakten werden strukturierte Chancen.",copy:"Kundenakte, Gesprächsnotizen, Termine, Dokumente und Verkaufsstatus laufen in einer zentralen Sicht zusammen.",benefit:"Keine Zettelwirtschaft. Kein Informationsverlust.",target:".nx-customer-mobile-list, .table-wrap, .card",action:"Öffne eine Demo-Kundenakte und entdecke den Verlauf."},
    {page:"Außendienst · HUNTER",eyebrow:"03 · FIELD HUNTER",title:"Neue Standorte finden. Tour planen. Vor Ort entscheiden.",copy:"Der HUNTER verbindet Recherche, Merkliste und Touren in einem Arbeitsbereich. Kontakte können direkt übernommen, abgelehnt oder weiterbearbeitet werden.",benefit:"Mehr Besuche mit weniger Umwegen und weniger Nacharbeit.",target:".nx-hunter-workspace-tabs",action:"Wechsle zwischen Finden, Merkliste und Touren."},
    {page:"Telefonleads",eyebrow:"04 · CALL HUNTER",title:"Telefonakquise ohne Listen-Chaos.",copy:"Eine fokussierte 10er-Arbeitsliste führt dich Kontakt für Kontakt durch Gesprächseinstieg, Anruf, Info-Freigabe, Rückruf und Termin.",benefit:"Ein Lead. Ein Gespräch. Eine klare nächste Aktion.",target:".nx-call-leads",action:"Starte den Demo-Call-Modus und teste die Swipe-Arbeitsweise."},
    {page:"Kalender",eyebrow:"05 · TERMINE",title:"Dein Außendienst bleibt verbindlich.",copy:"Termine, Rückrufe und Wiedervorlagen sind zentral sichtbar und direkt mit der Kundenakte verknüpft.",benefit:"Weniger vergessene Rückrufe. Mehr Verbindlichkeit.",target:".nx-calendar-card",action:"Tippe einen Demo-Termin an und sieh die Bearbeitung."},
    {page:"SumUp",eyebrow:"06 · SUMUP VERTRIEBSSTUDIO",title:"Vom Erstbedarf zum nachvollziehbaren Payment-Angebot.",copy:"Ob neue Kartenzahlung oder bestehende Lösung: Bedarf, Hardware, Gebühren und Abrechnung werden strukturiert aufgenommen und sauber dokumentiert.",benefit:"Beratung wird nachvollziehbar statt improvisiert.",target:".sales-studio, .card",action:"Teste Neueinstieg oder Vergleich einer bestehenden Payment-Lösung."},
    {page:"Software-Vertrieb",eyebrow:"07 · CRM SOFTWARE",title:"Auch Software-Anfragen bleiben im selben Vertriebsprozess.",copy:"Interessenten, Projektbedarf, Wiedervorlagen und Demo-Einladungen werden strukturiert bearbeitet und mit der zentralen Kundenakte verbunden.",benefit:"Payment, Außendienst und CRM-Vertrieb in einem Hub.",target:".software-sales",action:"Öffne die Beispielanfrage und sieh den Software-Vertriebsprozess."},
    {page:"Angebote & Rechnungen",eyebrow:"08 · ANGEBOT & FOLLOW-UP",title:"Der nächste Schritt bleibt im System.",copy:"Angebote, Rechnungen und Nachfassaktionen greifen ineinander. So endet der Prozess nicht beim PDF.",benefit:"Vom Angebot bis zur Nachverfolgung bleibt alles verbunden.",target:".card",action:"Öffne ein Demo-Angebot und entdecke die Folgeaktionen."},
    {page:"Vertriebswissen",eyebrow:"09 · VERTRIEBSWISSEN",title:"Auch im Kundengespräch hast du Unterstützung dabei.",copy:"Gesprächseinstieg, Bedarfsermittlung und Einwandbehandlung sind direkt im CRM abrufbar – mobil und durchsuchbar.",benefit:"Nicht nur verwalten. Sicherer und strukturierter verkaufen.",target:".nx-knowledge-guide-intro, .card",action:"Öffne einen Gesprächsleitfaden und probiere die Themenfilter."},
    {page:"Übersicht",eyebrow:"10 · DEIN NÄCHSTER SCHRITT",title:"Ein Sales Hub, der Akquise und Abschluss verbindet.",copy:"Von der Recherche und Telefonakquise über Termine und Beratung bis zum Angebot und Follow-up entsteht ein durchgängiger Vertriebsprozess.",benefit:"Mehr Übersicht. Mehr Konsequenz. Weniger Aufwand.",target:".nx-dashboard-shortcuts",action:"Du kannst die Demo jetzt frei weiter erkunden."}
  ];

  let index=0,started=false,free=false,muted=false,audio=null,focus=null,guide=null,freeControls=null;
  const $=(sel,root=document)=>root.querySelector(sel);
  const esc=s=>String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function navButton(label){return [...document.querySelectorAll("aside nav button")].find(b=>b.textContent&&b.textContent.trim().includes(label));}
  function navigate(label){
    document.body.classList.add("nx-demo-changing");
    const btn=navButton(label);
    if(btn)btn.click();
    setTimeout(()=>document.body.classList.remove("nx-demo-changing"),480);
  }
  function clearFocus(){if(focus){focus.classList.remove("nx-demo-focus");focus=null;}document.querySelectorAll(".nx-demo-focus").forEach(el=>el.classList.remove("nx-demo-focus"));}
  function setFocus(selector){
    clearFocus();
    if(!selector)return;
    const tries=[420,800,1300];
    tries.forEach(delay=>setTimeout(()=>{
      if(focus)return;
      const el=$(selector);
      if(!el)return;
      focus=el;el.classList.add("nx-demo-focus");
      try{el.scrollIntoView({behavior:"smooth",block:"center"});}catch{el.scrollIntoView();}
    },delay));
  }

  function createAudio(){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return null;
    const ctx=new AudioCtx(),master=ctx.createGain(),filter=ctx.createBiquadFilter();
    master.gain.value=.018;filter.type="lowpass";filter.frequency.value=650;filter.Q.value=.3;filter.connect(master);master.connect(ctx.destination);
    const nodes=[];
    [[110,"sine",.28],[164.81,"triangle",.11],[220,"sine",.08]].forEach(([freq,type,level])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=level;o.connect(g);g.connect(filter);o.start();nodes.push(o);
    });
    const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=.07;lg.gain.value=.004;lfo.connect(lg);lg.connect(master.gain);lfo.start();nodes.push(lfo);
    return {setMuted(value){const t=ctx.currentTime;master.gain.cancelScheduledValues(t);master.gain.linearRampToValueAtTime(value?0:.018,t+.22);},stop(){nodes.forEach(n=>{try{n.stop()}catch{}});ctx.close().catch(()=>{})}};
  }

  function intro(){
    document.body.classList.add("nx-demo-active");
    const el=document.createElement("div");el.className="nx-demo-intro";el.innerHTML=`<section class="nx-demo-intro-card" role="dialog" aria-modal="true" aria-label="Interaktive neXaro Demo">
      <span class="nx-demo-kicker">✦ INTERAKTIVE PRODUCT EXPERIENCE</span>
      <div class="nx-demo-logo">ne<span>X</span>aro</div>
      <h1>Erlebe deinen Vertrieb<br><em>in Bewegung.</em></h1>
      <p>Keine Folien. Keine statische Präsentation. Du bewegst dich direkt durch ein vollständig mit Beispieldaten gefülltes neXaro CRM.</p>
      <div class="nx-demo-intro-benefits"><span>10 interaktive Szenen</span><span>echte Demo-Daten</span><span>ca. 4 Minuten</span></div>
      <button class="nx-demo-start" type="button">▶ Demo Experience starten</button>
      <button class="nx-demo-skip-intro" type="button">Ohne Rundgang frei erkunden</button>
      <small>Leise Ambient-Begleitung startet erst nach deinem Klick und kann jederzeit stummgeschaltet werden.</small>
    </section>`;
    document.body.appendChild(el);
    $(".nx-demo-start",el).addEventListener("click",()=>{started=true;audio=createAudio();el.remove();showScene(0)});
    $(".nx-demo-skip-intro",el).addEventListener("click",()=>{started=true;free=true;el.remove();showFreeControls()});
  }

  function guideTemplate(scene){const pct=((index+1)/scenes.length)*100;return `<div class="nx-demo-guide-top"><span>${esc(scene.eyebrow)}</span><div class="nx-demo-guide-actions"><button type="button" data-demo="sound" aria-label="${muted?"Musik einschalten":"Musik stummschalten"}">${muted?"🔇":"♫"}</button><button type="button" data-demo="free" aria-label="Rundgang schließen und frei erkunden">✕</button></div></div>
    <div class="nx-demo-progress"><i style="width:${pct}%"></i></div>
    <div class="nx-demo-scene-number">${String(index+1).padStart(2,"0")}<small> / ${String(scenes.length).padStart(2,"0")}</small></div>
    <h2>${esc(scene.title)}</h2><p>${esc(scene.copy)}</p>
    <div class="nx-demo-benefit"><span>✦</span><strong>${esc(scene.benefit)}</strong></div>
    <div class="nx-demo-action"><span>☝</span><span>${esc(scene.action)}</span></div>
    <div class="nx-demo-navigation"><button type="button" class="secondary" data-demo="prev" ${index===0?"disabled":""}>← Zurück</button><button type="button" class="primary" data-demo="next">${index<scenes.length-1?"Weiter →":"CRM frei erkunden →"}</button></div>
    <button type="button" class="nx-demo-exit" data-demo="exit">Demo verlassen</button>`}

  function showScene(next){
    free=false;index=Math.max(0,Math.min(scenes.length-1,next));clearFocus();if(freeControls){freeControls.remove();freeControls=null;}
    const scene=scenes[index];navigate(scene.page);
    if(!guide){const wash=document.createElement("div");wash.className="nx-demo-stage-wash";wash.dataset.nxDemo="wash";document.body.appendChild(wash);guide=document.createElement("aside");guide.className="nx-demo-guide";guide.setAttribute("aria-live","polite");document.body.appendChild(guide);}
    guide.innerHTML=guideTemplate(scene);
    $("[data-demo=sound]",guide).addEventListener("click",toggleSound);$("[data-demo=free]",guide).addEventListener("click",enterFree);$("[data-demo=prev]",guide).addEventListener("click",()=>showScene(index-1));$("[data-demo=next]",guide).addEventListener("click",()=>index<scenes.length-1?showScene(index+1):enterFree());$("[data-demo=exit]",guide).addEventListener("click",exitDemo);
    setFocus(scene.target);
  }

  function toggleSound(){muted=!muted;if(audio)audio.setMuted(muted);if(guide)showScene(index);if(freeControls)renderFreeControls();}
  function enterFree(){free=true;clearFocus();if(guide){guide.remove();guide=null;}const wash=$("[data-nx-demo=wash]");if(wash)wash.remove();showFreeControls();}
  function renderFreeControls(){if(!freeControls)return;freeControls.innerHTML=`<button type="button" data-free="tour">✦ Rundgang starten</button>${audio?`<button type="button" data-free="sound" aria-label="${muted?"Musik einschalten":"Musik stummschalten"}">${muted?"🔇":"♫"}</button>`:""}<button type="button" data-free="exit">✕ Demo verlassen</button>`;$("[data-free=tour]",freeControls).addEventListener("click",()=>showScene(0));const sound=$("[data-free=sound]",freeControls);if(sound)sound.addEventListener("click",toggleSound);$("[data-free=exit]",freeControls).addEventListener("click",exitDemo);}
  function showFreeControls(){if(guide){guide.remove();guide=null;}if(!freeControls){freeControls=document.createElement("div");freeControls.className="nx-demo-free-controls";document.body.appendChild(freeControls);}renderFreeControls();}
  function exitDemo(){clearFocus();if(audio){audio.stop();audio=null;}document.querySelectorAll("[data-nx-demo=wash],.nx-demo-guide,.nx-demo-free-controls,.nx-demo-intro").forEach(el=>el.remove());document.body.classList.remove("nx-demo-active","nx-demo-changing");const url=new URL(location.href);url.searchParams.delete("demo");url.searchParams.delete("nx");location.href=url.pathname+url.search;}

  addEventListener("keydown",event=>{if(!started||free)return;if(event.key==="ArrowRight"&&index<scenes.length-1)showScene(index+1);if(event.key==="ArrowLeft"&&index>0)showScene(index-1);if(event.key==="Escape")enterFree();});
  addEventListener("beforeunload",()=>audio&&audio.stop());
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",intro,{once:true});else intro();
})();