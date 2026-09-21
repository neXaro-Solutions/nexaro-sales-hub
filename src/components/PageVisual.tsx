import type { ComponentType } from "react";
import {
  ArrowRight, BadgeCheck, BookOpen, CalendarCheck2, CreditCard,
  FileText, MapPinned, Package, Search, Settings2, Sparkles,
  Store, Users, WalletCards
} from "lucide-react";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const visuals: Record<string, { title: string; subtitle: string; icon: Icon; detail: Icon; label: string }> = {
  customers: { title: "Jeder Standort zählt.", subtitle: "Kontakte, Gesprächsnotizen und Chancen übersichtlich an einem Ort.", icon: Users, detail: Store, label: "KUNDEN & LEADS" },
  routes: { title: "Dein Außendienst. Dein Weg.", subtitle: "Standorte entdecken, Besuche planen und direkt navigieren.", icon: MapPinned, detail: Search, label: "STANDORTE & ROUTEN" },
  sumup: { title: "Payment sichtbar machen.", subtitle: "Bedarf verstehen, Tarife vergleichen und passende Lösungen zeigen.", icon: CreditCard, detail: WalletCards, label: "SUMUP VERTRIEB" },
  vape: { title: "Produkte im Blick.", subtitle: "Händler und B2B-Sortiment schnell und strukturiert betreuen.", icon: Package, detail: Store, label: "VAPE B2B" },
  offers: { title: "Angebote mit Wirkung.", subtitle: "Vergleiche, Angebote und Rechnungen auf einen Blick.", icon: FileText, detail: BadgeCheck, label: "DOKUMENTE" },
  knowledge: { title: "Wissen für unterwegs.", subtitle: "Produktwissen und Gesprächshilfen griffbereit, wenn du sie brauchst.", icon: BookOpen, detail: Sparkles, label: "VERTRIEBSWISSEN" },
  tasks: { title: "Kein Kontakt geht verloren.", subtitle: "Wiedervorlagen und nächste Schritte ohne Umwege.", icon: CalendarCheck2, detail: BadgeCheck, label: "DEINE AUFGABEN" },
  settings: { title: "Alles unter Kontrolle.", subtitle: "Dein zentraler Arbeitsbereich und seine Einstellungen.", icon: Settings2, detail: BadgeCheck, label: "SYSTEM & SICHERUNG" },
};

export function PageVisual({ page }: { page: string }) {
  const item = visuals[page];
  if (!item) return null;
  const Icon = item.icon;
  const Detail = item.detail;
  return (
    <div className={`nx-page-visual nx-page-visual--${page}`}>
      <div className="nx-page-visual__copy">
        <span className="nx-page-visual__eyebrow"><Sparkles size={15} /> {item.label}</span>
        <h2>{item.title}</h2>
        <p>{item.subtitle}</p>
      </div>
      <div className="nx-page-visual__art" aria-hidden="true">
        <span className="nx-page-visual__halo" />
        <span className="nx-page-visual__main"><Icon size={49} strokeWidth={1.65} /></span>
        <span className="nx-page-visual__detail"><Detail size={24} strokeWidth={1.85} /></span>
        <span className="nx-page-visual__spark"><ArrowRight size={19} /></span>
        <span className="nx-page-visual__dot" />
      </div>
    </div>
  );
}
export function DashboardIllustration() {
  return (
    <div className="nx-dashboard-illustration" aria-hidden="true">
      <span className="nx-dashboard-illustration__back" />
      <div className="nx-dashboard-illustration__card">
        <span className="nx-dashboard-illustration__mini"><Store size={20}/><span/><span/></span>
        <span className="nx-dashboard-illustration__chart"><i/><i/><i/><i/><i/></span>
        <span className="nx-dashboard-illustration__foot"><BadgeCheck size={19}/> SALES HUB</span>
      </div>
      <span className="nx-dashboard-illustration__payment"><CreditCard size={29}/></span>
      <span className="nx-dashboard-illustration__people"><Users size={24}/></span>
      <span className="nx-dashboard-illustration__spark"><Sparkles size={26}/></span>
    </div>
  );
}
