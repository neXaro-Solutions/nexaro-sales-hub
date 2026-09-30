import { useEffect, useState, Component, type ReactNode } from "react";
import {
  LayoutDashboard, House, ChevronRight, Users, CreditCard, Package, Crosshair,
  CheckSquare, CalendarDays, FileText, BookOpen, Settings as SettingsIcon,
  LogOut, Menu, X, ShieldCheck, ArrowRight, RefreshCw, LockKeyhole,
} from "lucide-react";
import { client } from "./lib/client";
import { NotificationCenter } from "./components/NotificationCenter";
import { DataProvider, useStore } from "./lib/store";
import { Brand, Field } from "./components/UI";
import { PageVisual } from "./components/PageVisual";
import { CustomerForm, TaskForm } from "./components/Forms";
import { Dashboard } from "./pages/Dashboard";
import { DashboardCalendar } from "./components/DashboardCalendar";
import { Customers } from "./pages/Customers";
import { Sumup } from "./pages/Sumup";
import { Dealers } from "./pages/Dealers";
import { Hunter } from "./pages/Hunter";
import { Tasks } from "./pages/Tasks";
import { Offers } from "./pages/Offers";
import { KnowledgeBase } from "./pages/KnowledgeBase";
import { Settings } from "./pages/Settings";
import { SoftwareSales } from "./pages/SoftwareSales";
import { canAccessPage, canEdit, roleLabels, type OrganizationRole } from "./lib/access";

const nav = [
  { id: "dashboard", label: "Übersicht", icon: LayoutDashboard },
  { id: "customers", label: "Kunden & Leads", icon: Users },
  { id: "hunter", label: "Außendienst · HUNTER", icon: Crosshair },
  { id: "calendar", label: "Kalender", icon: CalendarDays },
  { id: "sumup", label: "SumUp", icon: CreditCard },
  { id: "vape", label: "Vape", icon: Package },
  { id: "software", label: "Software-Vertrieb", icon: Users },
  { id: "offers", label: "Angebote & Rechnungen", icon: FileText },
  { id: "knowledge", label: "Vertriebswissen", icon: BookOpen },
  { id: "tasks", label: "Aufgaben", icon: CheckSquare },
  { id: "settings", label: "System & Sicherung", icon: SettingsIcon },
];

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="fatal">
      <h1>Diese Ansicht konnte nicht geladen werden.</h1>
      <p>Bereits gespeicherte Daten bleiben erhalten. Bitte lade die Anwendung neu.</p>
      <button className="primary" onClick={() => window.location.reload()}>Neu laden</button>
    </div> : this.props.children;
  }
}

function Shell({ onLogout, role }: { onLogout: () => void; role: OrganizationRole }) {
  const { data, demo, loading, error, refresh } = useStore();
  const visibleNav = nav.filter(n => demo || canAccessPage(role, n.id));
  const writable = demo || canEdit(role);
  const [page, setPage] = useState(() => {
    const target = new URLSearchParams(location.search).get("nx");
    const requested = target === "software" ? "software" : target === "inquiry" ? "customers" : target === "appointment" || target === "task" ? "tasks" : "dashboard";
    return demo || canAccessPage(role, requested) ? requested : "dashboard";
  });
  const [mobile, setMobile] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);
  const [sumupCustomer, setSumupCustomer] = useState("");
  const [hunterStart, setHunterStart] = useState<"leads" | "tour">("leads");
  const [newTask, setNewTask] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [accessNotice, setAccessNotice] = useState("");

  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  useEffect(() => {
    if (!demo && !canAccessPage(role, page)) setPage("dashboard");
  }, [demo, role, page]);

  function denyWrite() {
    setAccessNotice("Deine Rolle „Nur Lesen“ darf CRM-Daten ansehen, aber nicht verändern.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openNewCustomer() { writable ? setNewCustomer(true) : denyWrite(); }
  function openNewTask() { writable ? setNewTask(true) : denyWrite(); }

  function navigate(p: string, customerId = "") {
    if (p === "routes") { setHunterStart("tour"); p = "hunter"; }
    else if (p === "hunter") setHunterStart("leads");
    if (!demo && !canAccessPage(role, p)) {
      setAccessNotice(`Der Bereich „${nav.find(n => n.id === p)?.label || p}“ ist für deine Rolle ${roleLabels[role]} nicht freigegeben.`);
      p = "dashboard";
    } else setAccessNotice("");
    if (p === "sumup") setSumupCustomer(customerId);
    setPage(p); setMobile(false); window.scrollTo(0, 0);
  }

  return <div className="app-shell" data-role={demo ? "demo" : role}>
    <aside className={"sidebar " + (mobile ? "open" : "")}>
      <div className="sidebar-brand"><Brand /><button className="icon-button mobile-only" onClick={() => setMobile(false)} aria-label="Menü schließen"><X /></button></div>
      <div className="workspace-label"><span className="orange-dot" /> neXaro CRM <span>09/26</span></div>
      <nav>
        {visibleNav.map(n => <div key={n.id}>
          {n.id === "sumup" && <span className="nav-section">VERTRIEBSBEREICHE</span>}
          {n.id === "knowledge" && <span className="nav-section">ORGANISATION</span>}
          <button className={page === n.id ? "active" : ""} onClick={() => navigate(n.id)}>
            <n.icon size={19} />{n.label}
            {n.id === "tasks" && data.tasks.some(t => !t.done) && <span className="nav-count">{data.tasks.filter(t => !t.done).length}</span>}
          </button>
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="brand-promise">Starke Marken.<br />Starke Standorte.</div>
        <div className="profile"><span>NX</span><div><strong>neXaro Solutions</strong><small>{demo ? "Demo-Modus" : roleLabels[role]}</small></div><button className="icon-button" aria-label={demo ? "Demo verlassen" : "Abmelden"} onClick={onLogout}><LogOut size={18} /></button></div>
      </div>
    </aside>
    {mobile && <button className="mobile-overlay" aria-label="Menü schließen" onClick={() => setMobile(false)} />}
    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumb">
          <button className="icon-button mobile-only" onClick={() => setMobile(true)} aria-label="Menü öffnen"><Menu /></button>
          <button type="button" className="nx-breadcrumb-home" onClick={() => navigate("dashboard")} aria-label="Zur Dashboard-Übersicht"><House size={15}/><span>Übersicht</span></button>
          {page !== "dashboard" && <><ChevronRight className="nx-breadcrumb-chevron" size={14}/><b>{nav.find(n => n.id === page)?.label}</b></>}
        </div>
        <div className="topbar-right">
          <NotificationCenter demo={demo} navigate={navigate}/>
          <span className={"connection " + (!online ? "offline" : "")}><i />{demo ? "Demo" : online ? "Online" : "Offline"}</span>
          <span className="top-date">{new Date().toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "long" })}</span>
          <div className="avatar">NX</div>
        </div>
      </header>
      <main>
        {demo && <div className="demo-banner"><b>DEMO</b> Fiktive Beispieldaten · Änderungen werden nicht dauerhaft gespeichert.<button onClick={onLogout}>Zur Anmeldung <ArrowRight size={14}/></button></div>}
        {!demo && role === "read_only" && <div className="nx-role-banner"><ShieldCheck size={17}/><div><strong>Lesemodus · Nur Lesen</strong><span>Du kannst CRM-Daten ansehen. Änderungen, neue Datensätze und Löschungen sind für diese Rolle gesperrt.</span></div></div>}
        {accessNotice && <div className="notice" role="status">{accessNotice}</div>}
        {!online && <p className="error" role="status">Keine Internetverbindung. Speichern und Recherche benötigen eine Verbindung. Bitte geöffnete Formulare noch nicht schließen.</p>}
        {error && <div className="error" role="alert">{error}<button className="text-button" onClick={() => void refresh()}><RefreshCw size={15}/> Erneut laden</button></div>}
        {page !== "dashboard" && !loading && <div className="nx-page-backbar"><button type="button" className="nx-back-dashboard" onClick={() => navigate("dashboard")}><House size={17}/> Zur Übersicht <ArrowRight size={15}/></button><span>{nav.find(n => n.id === page)?.label || "Dein CRM"}</span></div>}
        {!loading && <PageVisual page={page} />}
        {loading ? <div className="loading">Dein Arbeitsbereich wird geladen …</div> : <ErrorBoundary key={page}>
          {page === "dashboard" && <Dashboard navigate={navigate} newCustomer={openNewCustomer} newTask={openNewTask} />}
          {page === "customers" && <Customers onOpenSumup={id => navigate("sumup", id)}/>} 
          {page === "sumup" && <Sumup key={sumupCustomer || "general"} initialCustomerId={sumupCustomer}/>} 
          {page === "vape" && <Dealers />} 
          {page === "software" && <SoftwareSales />} 
          {page === "tasks" && <Tasks />} 
          {page === "calendar" && <DashboardCalendar newTask={openNewTask} navigate={navigate} />} 
          {page === "hunter" && <Hunter key={hunterStart} initialTab={hunterStart}/>} 
          {page === "offers" && <Offers />} 
          {page === "knowledge" && <KnowledgeBase />} 
          {page === "settings" && <Settings />}
        </ErrorBoundary>}
        <footer className="app-footer"><span>neXaro Solutions · Gemeinsam mehr erreichen.</span><span><ShieldCheck size={13}/> Dein geschützter Vertriebsbereich</span></footer>
      </main>
    </div>
    {newCustomer && writable && <CustomerForm onClose={() => setNewCustomer(false)} />} 
    {newTask && writable && <TaskForm onClose={() => setNewTask(false)} />}
  </div>;
}

export default function App() {
  const [demo, setDemo] = useState(new URLSearchParams(location.search).get("demo") === "1");
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState<OrganizationRole>("read_only");
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo) { setRole("owner"); setChecking(false); return; }
    let active = true, attempt = 0;
    async function authorize() {
      const run = ++attempt;
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (!active || run !== attempt) return;
      if (userError || !user) { setAuthorized(false); setChecking(false); return; }
      const [ownerResult, memberResult] = await Promise.all([
        client.from("nx_owner").select("user_id").eq("user_id", user.id).maybeSingle(),
        client.from("nx_organization_members").select("organization_id,role,status").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active || run !== attempt) return;
      if (ownerResult.data && !ownerResult.error) {
        setRole("owner"); setAuthorized(true); setError(""); setChecking(false); return;
      }
      let membership = memberResult.data;
      if (membership?.status === "invited") {
        const activation = await client.functions.invoke("nx-team-admin", { body: { action: "activate-self" } });
        if (!activation.error && activation.data?.ok) membership = { ...membership, status: "active" };
      }
      if (!active || run !== attempt) return;
      const allowed = membership?.status === "active";
      const nextRole = membership?.role as OrganizationRole | undefined;
      setAuthorized(!!allowed);
      if (allowed && nextRole) { setRole(nextRole); setError(""); }
      else if (membership?.status === "disabled") setError("Dieser Teamzugang wurde deaktiviert. Bitte wende dich an den Owner deiner Organisation.");
      else setError("Dieses Konto ist keiner aktiven neXaro Organisation zugeordnet. Bitte verwende deinen persönlichen Teamzugang oder wende dich an den Administrator.");
      setChecking(false);
    }
    void authorize();
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) { attempt++; setAuthorized(false); setRole("read_only"); setChecking(false); }
      else setTimeout(() => void authorize(), 0);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [demo]);

  async function logout() {
    if (demo) { setDemo(false); history.replaceState(null, "", location.pathname); setChecking(true); return; }
    await client.auth.signOut({ scope: "local" }); setAuthorized(false); setRole("read_only");
  }

  if (demo || authorized) return <DataProvider key={demo ? "demo" : "live"} demo={demo}><Shell role={demo ? "owner" : role} onLogout={() => void logout()} /></DataProvider>;

  return <div className="login-page">
    <div className="login-story"><Brand /><div><span className="eyebrow">DEIN VERTRIEB. EINE ZENTRALE.</span><p className="badge sumup">CRM-Integration September 2026 · Alle Module zentral</p><h1>Mehr<br/>Umsatzpotenzial.<br/><span>Weniger Aufwand.</span></h1><p>Payment, Trendprodukte und starke Kundenbeziehungen.<br/>Willkommen in deinem neXaro Sales Hub.</p></div><span className="login-tag">PEOPLE · PAYMENT · PRODUCTS · PROGRESS</span><div className="login-x" aria-hidden="true">X</div></div>
    <div className="login-panel"><div className="login-card"><div className="lock-mark"><LockKeyhole size={24}/></div><span className="eyebrow">GESCHÜTZTER ARBEITSBEREICH</span><small className="badge positive">neXaro CRM · Organisation & Team</small><h2>Bereit für deinen nächsten Abschluss?</h2><p>Melde dich mit deinem persönlichen neXaro Zugang an.</p>
      <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); const f = new FormData(e.currentTarget); const { error } = await client.auth.signInWithPassword({ email: String(f.get("email")).trim(), password: String(f.get("password")) }); if (error) setError("Anmeldung fehlgeschlagen. E-Mail und Passwort bitte prüfen."); setBusy(false); }}>
        <Field label="E-Mail"><input autoComplete="username" type="email" name="email" required/></Field>
        <Field label="Passwort"><input autoComplete="current-password" type="password" name="password" required/></Field>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary wide" disabled={busy || checking}>{busy ? "Anmeldung läuft …" : checking ? "Zugang wird geprüft …" : "Zum Sales Hub"} <ArrowRight size={17}/></button>
      </form>
      <button className="demo-link" onClick={() => { history.replaceState(null, "", location.pathname + "?demo=1"); setDemo(true); }}>Mit Beispieldaten ansehen <ArrowRight size={15}/></button>
      <p className="login-security"><ShieldCheck size={15}/> Persönlicher Login · Organisationsgeschützte Kundendaten</p>
    </div></div>
  </div>;
}
