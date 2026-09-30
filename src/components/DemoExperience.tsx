import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  MousePointerClick,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type DemoScene = {
  page: string;
  eyebrow: string;
  title: string;
  copy: string;
  benefit: string;
  target?: string;
  action?: string;
};

const scenes: DemoScene[] = [
  {
    page: "dashboard",
    eyebrow: "01 · DEIN ARBEITSTAG",
    title: "Alles Wichtige beginnt an einem Ort.",
    copy: "Termine, offene Aufgaben, neue Anfragen und Vertriebskennzahlen liegen direkt vor dir – ohne zwischen Listen springen zu müssen.",
    benefit: "Sofort wissen, was heute wirklich zählt.",
    target: ".nx-dashboard-shortcuts",
    action: "Klicke gern auf eine der Schnellaktionen.",
  },
  {
    page: "customers",
    eyebrow: "02 · KUNDEN & LEADS",
    title: "Aus Kontakten werden strukturierte Chancen.",
    copy: "Kundenakte, Gesprächsnotizen, Termine, Dokumente und Verkaufsstatus laufen in einer zentralen Sicht zusammen.",
    benefit: "Keine Zettelwirtschaft. Kein Informationsverlust.",
    target: ".nx-customer-mobile-list, .table-wrap",
    action: "Öffne eine Demo-Kundenakte und entdecke den Verlauf.",
  },
  {
    page: "hunter",
    eyebrow: "03 · AUSSENDIENST",
    title: "Neue Standorte finden. Tour planen. Vor Ort entscheiden.",
    copy: "Der HUNTER verbindet Recherche, Merkliste und Touren in einem Arbeitsbereich. Kontakte können direkt übernommen, abgelehnt oder weiterbearbeitet werden.",
    benefit: "Mehr Besuche mit weniger Umwegen und weniger Nacharbeit.",
    target: ".nx-hunter-workspace-tabs",
    action: "Wechsle zwischen Finden, Merkliste und Touren.",
  },
  {
    page: "calendar",
    eyebrow: "04 · TERMINE",
    title: "Dein Außendienst bleibt verbindlich.",
    copy: "Termine und Wiedervorlagen sind zentral sichtbar. Ein Klick öffnet den Termin direkt zur Bearbeitung.",
    benefit: "Weniger vergessene Rückrufe. Mehr Verbindlichkeit.",
    target: ".nx-calendar-card",
    action: "Tippe einen Demo-Termin an und sieh die Bearbeitung.",
  },
  {
    page: "sumup",
    eyebrow: "05 · SUMUP VERTRIEBSSTUDIO",
    title: "Vom Gespräch zum nachvollziehbaren Vergleich.",
    copy: "Bedarf, Abrechnung und Ist-Konditionen werden geprüft, bevor ein Vergleich oder Angebot vorbereitet wird.",
    benefit: "Beratung wird nachvollziehbar statt improvisiert.",
    target: ".sales-studio, .card",
    action: "Erkunde die einzelnen Beratungsschritte.",
  },
  {
    page: "offers",
    eyebrow: "06 · ANGEBOT & FOLLOW-UP",
    title: "Der nächste Schritt bleibt im System.",
    copy: "Angebote, Rechnungen und Nachfassaktionen greifen ineinander. So endet der Prozess nicht beim PDF.",
    benefit: "Vom Angebot bis zur Nachverfolgung bleibt alles verbunden.",
    target: ".card",
    action: "Öffne ein Demo-Angebot und entdecke die Folgeaktionen.",
  },
  {
    page: "knowledge",
    eyebrow: "07 · VERTRIEBSWISSEN",
    title: "Auch im Kundengespräch hast du Unterstützung dabei.",
    copy: "Gesprächseinstieg, Bedarfsermittlung und Einwandbehandlung sind direkt im CRM abrufbar – mobil und durchsuchbar.",
    benefit: "Nicht nur verwalten. Sicherer und strukturierter verkaufen.",
    target: ".nx-knowledge-guide-intro",
    action: "Öffne einen Gesprächsleitfaden und probiere die Themenfilter.",
  },
  {
    page: "dashboard",
    eyebrow: "08 · DEIN NÄCHSTER SCHRITT",
    title: "Ein CRM, das deinen Außendienst wirklich begleitet.",
    copy: "Von der ersten Chance über den Besuch bis zum Angebot und zur Nachverfolgung entsteht ein durchgängiger Vertriebsprozess.",
    benefit: "Mehr Übersicht. Mehr Konsequenz. Weniger Aufwand.",
    target: ".nx-dashboard-shortcuts",
    action: "Du kannst die Demo jetzt frei weiter erkunden.",
  },
];

function createAmbientAudio() {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.gain.value = 0.022;
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  filter.Q.value = 0.35;
  filter.connect(master);

  const oscillators: OscillatorNode[] = [];
  [110, 164.81, 220].forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index === 1 ? "triangle" : "sine";
    osc.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.32 : 0.12;
    osc.connect(gain);
    gain.connect(filter);
    osc.start();
    oscillators.push(osc);
  });

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.006;
  lfo.connect(lfoGain);
  lfoGain.connect(master.gain);
  lfo.start();
  oscillators.push(lfo);

  return {
    ctx,
    setMuted(muted: boolean) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.022, ctx.currentTime + 0.2);
    },
    stop() {
      oscillators.forEach((osc) => {
        try { osc.stop(); } catch { /* already stopped */ }
      });
      void ctx.close();
    },
  };
}

export function DemoExperience({
  navigate,
  onExit,
}: {
  navigate: (page: string) => void;
  onExit: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [freeMode, setFreeMode] = useState(false);
  const audio = useRef<ReturnType<typeof createAmbientAudio>>(null);
  const scene = scenes[index];

  useEffect(() => () => audio.current?.stop(), []);

  useEffect(() => {
    if (!started || freeMode) return;
    navigate(scene.page);
    let focused: Element | null = null;
    const timer = window.setTimeout(() => {
      if (scene.target) {
        focused = document.querySelector(scene.target);
        focused?.classList.add("nx-demo-focus");
        focused?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 420);
    return () => {
      window.clearTimeout(timer);
      focused?.classList.remove("nx-demo-focus");
      document.querySelectorAll(".nx-demo-focus").forEach((el) => el.classList.remove("nx-demo-focus"));
    };
  }, [index, started, freeMode, scene, navigate]);

  useEffect(() => {
    if (!started || freeMode) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && index < scenes.length - 1) setIndex((v) => v + 1);
      if (event.key === "ArrowLeft" && index > 0) setIndex((v) => v - 1);
      if (event.key === "Escape") setFreeMode(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [started, freeMode, index]);

  function start() {
    setStarted(true);
    audio.current = createAmbientAudio();
    navigate(scenes[0].page);
  }

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    audio.current?.setMuted(next);
  }

  if (!started) {
    return <div className="nx-demo-intro" role="dialog" aria-modal="true" aria-label="Interaktive neXaro Demo">
      <div className="nx-demo-aurora" aria-hidden="true" />
      <section className="nx-demo-intro-card">
        <span className="nx-demo-kicker"><Sparkles size={15}/> INTERAKTIVE PRODUCT EXPERIENCE</span>
        <div className="nx-demo-logo">ne<span>X</span>aro</div>
        <h1>Erlebe deinen Vertrieb<br/><em>in Bewegung.</em></h1>
        <p>Keine Folien. Keine statische Präsentation. Du bewegst dich direkt durch ein vollständig mit Beispieldaten gefülltes neXaro CRM.</p>
        <div className="nx-demo-intro-benefits">
          <span>8 interaktive Szenen</span><span>echte Demo-Daten</span><span>ca. 4 Minuten</span>
        </div>
        <button className="nx-demo-start" type="button" onClick={start}><Play size={19} fill="currentColor"/> Demo Experience starten</button>
        <button className="nx-demo-skip-intro" type="button" onClick={()=>{setStarted(true);setFreeMode(true)}}>Ohne Rundgang frei erkunden</button>
        <small>Leise Ambient-Begleitung startet erst nach deinem Klick und kann jederzeit stummgeschaltet werden.</small>
      </section>
    </div>;
  }

  if (freeMode) {
    return <div className="nx-demo-free-controls">
      <button type="button" onClick={()=>{setFreeMode(false);setIndex(0)}}><Sparkles size={15}/> Rundgang starten</button>
      {audio.current&&<button type="button" onClick={toggleSound} aria-label={muted?"Musik einschalten":"Musik stummschalten"}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button>}
      <button type="button" onClick={onExit}><X size={16}/> Demo verlassen</button>
    </div>;
  }

  const progress = ((index + 1) / scenes.length) * 100;
  return <>
    <div className="nx-demo-stage-wash" aria-hidden="true" />
    <aside className="nx-demo-guide" aria-live="polite">
      <div className="nx-demo-guide-top">
        <span>{scene.eyebrow}</span>
        <div className="nx-demo-guide-actions">
          <button type="button" onClick={toggleSound} aria-label={muted?"Musik einschalten":"Musik stummschalten"}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button>
          <button type="button" onClick={()=>setFreeMode(true)} aria-label="Rundgang schließen und frei erkunden"><X size={16}/></button>
        </div>
      </div>
      <div className="nx-demo-progress"><i style={{width: progress+"%"}}/></div>
      <div className="nx-demo-scene-number">{String(index+1).padStart(2,"0")}<small> / {String(scenes.length).padStart(2,"0")}</small></div>
      <h2>{scene.title}</h2>
      <p>{scene.copy}</p>
      <div className="nx-demo-benefit"><Sparkles size={15}/><strong>{scene.benefit}</strong></div>
      {scene.action&&<div className="nx-demo-action"><MousePointerClick size={15}/><span>{scene.action}</span></div>}
      <div className="nx-demo-navigation">
        <button type="button" className="secondary" disabled={index===0} onClick={()=>setIndex(v=>Math.max(0,v-1))}><ArrowLeft size={16}/> Zurück</button>
        {index<scenes.length-1
          ? <button type="button" className="primary" onClick={()=>setIndex(v=>Math.min(scenes.length-1,v+1))}>Weiter <ArrowRight size={16}/></button>
          : <button type="button" className="primary" onClick={()=>setFreeMode(true)}>CRM frei erkunden <ArrowRight size={16}/></button>}
      </div>
      <button type="button" className="nx-demo-exit" onClick={onExit}>Demo verlassen</button>
    </aside>
  </>;
}
