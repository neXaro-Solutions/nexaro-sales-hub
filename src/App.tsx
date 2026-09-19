import { useEffect, useState, Component, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Map,
  CheckSquare,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  LockKeyhole,
} from "lucide-react";
import { client } from "./lib/client";
import { DataProvider, useStore } from "./lib/store";
import { Brand, Field } from "./components/UI";
import { CustomerForm, TaskForm } from "./components/Forms";
import { Dashboard } from "./pages/Dashboard";
import { Customers } from "./pages/Customers";
import { Sumup } from "./pages/Sumup";
import { Vapes } from "./pages/Vapes";
import { Routes } from "./pages/Routes";
import { Tasks } from "./pages/Tasks";
import { Offers } from "./pages/Offers";
import { Settings } from "./pages/Settings";
const nav = [
  { id: "dashboard", label: "Übersicht", icon: LayoutDashboard },
  { id: "customers", label: "Kunden & Leads", icon: Users },
  { id: "tasks", label: "Aufgaben", icon: CheckSquare },
  { id: "routes", label: "Gebiet & Tagesroute", icon: Map },
  { id: "sumup", label: "SumUp Vertrieb", icon: CreditCard },
  { id: "vape", label: "Vapes & Trends", icon: Package },
  { id: "offers", label: "Angebote", icon: FileText },
  { id: "settings", label: "System & Sicherung", icon: SettingsIcon },
];
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fatal">
        <h1>Diese Ansicht konnte nicht geladen werden.</h1>
        <p>
          Bereits gespeicherte Daten bleiben erhalten. Bitte lade die Anwendung
          neu.
        </p>
        <button className="primary" onClick={() => window.location.reload()}>
          Neu laden
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Shell({ onLogout }: { onLogout: () => void }) {
  const { data, demo, loading, error, refresh } = useStore();
  const [page, setPage] = useState("dashboard"),
    [mobile, setMobile] = useState(false),
    [newCustomer, setNewCustomer] = useState(false),
    [newTask, setNewTask] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true),
      down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  function navigate(p: string) {
    setPage(p);
    setMobile(false);
    window.scrollTo(0, 0);
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            onClick={() => setMobile(false)}
            aria-label="Menü schließen"
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          <span className="orange-dot" /> SALES HUB <span>01</span>
        </div>
        <nav>
          {nav.map((n, i) => (
            <div key={n.id}>
              {i === 4 && (
                <span className="nav-section">VERTRIEBSBEREICHE</span>
              )}
              {i === 7 && <span className="nav-section">VERWALTUNG</span>}
              <button
                className={page === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={19} />
                {n.label}
                {n.id === "tasks" && data.tasks.some((t) => !t.done) && (
                  <span className="nav-count">
                    {data.tasks.filter((t) => !t.done).length}
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="brand-promise">
            Starke Marken.
            <br />
            Starke Standorte.
          </div>
          <div className="profile">
            <span>NX</span>
            <div>
              <strong>neXaro Solutions</strong>
              <small>
                {demo ? "Demo-Modus" : "Persönlicher Arbeitsbereich"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label={demo ? "Demo verlassen" : "Abmelden"}
              onClick={onLogout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label="Menü schließen"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Menü öffnen"
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <b>{nav.find((n) => n.id === page)?.label}</b>
          </div>
          <div className="topbar-right">
            <span className={"connection " + (!online ? "offline" : "")}>
              <i />
              {demo ? "Demo" : online ? "Online" : "Offline"}
            </span>
            <span className="top-date">
              {new Date().toLocaleDateString("de-DE", {
                weekday: "short",
                day: "2-digit",
                month: "long",
              })}
            </span>
            <div className="avatar">NX</div>
          </div>
        </header>
        <main>
          {demo && (
            <div className="demo-banner">
              <b>DEMO</b> Fiktive Beispieldaten · Änderungen werden nicht
              dauerhaft gespeichert.
              <button onClick={onLogout}>
                Zur Anmeldung <ArrowRight size={14} />
              </button>
            </div>
          )}
          {!online && (
            <p className="error" role="status">
              Keine Internetverbindung. Speichern und Recherche benötigen eine
              Verbindung. Bitte geöffnete Formulare noch nicht schließen.
            </p>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text-button" onClick={() => void refresh()}>
                <RefreshCw size={15} /> Erneut laden
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">Dein Arbeitsbereich wird geladen …</div>
          ) : (
            <ErrorBoundary key={page}>
              {page === "dashboard" && (
                <Dashboard
                  navigate={navigate}
                  newCustomer={() => setNewCustomer(true)}
                  newTask={() => setNewTask(true)}
                />
              )}{" "}
              {page === "customers" && <Customers />}
              {page === "sumup" && <Sumup />}
              {page === "vape" && <Vapes />}
              {page === "tasks" && <Tasks />}
              {page === "routes" && <Routes />}
              {page === "offers" && <Offers />}
              {page === "settings" && <Settings />}
            </ErrorBoundary>
          )}
          <footer className="app-footer">
            <span>neXaro Solutions · Gemeinsam mehr erreichen.</span>
            <span>
              <ShieldCheck size={13} /> Dein geschützter Vertriebsbereich
            </span>
          </footer>
        </main>
      </div>
      {newCustomer && <CustomerForm onClose={() => setNewCustomer(false)} />}{" "}
      {newTask && <TaskForm onClose={() => setNewTask(false)} />}
    </div>
  );
}
export default function App() {
  const [demo, setDemo] = useState(
      new URLSearchParams(location.search).get("demo") === "1",
    ),
    [authorized, setAuthorized] = useState(false),
    [checking, setChecking] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (demo) {
      setChecking(false);
      return;
    }
    let active = true,
      attempt = 0;
    async function authorize() {
      const run = ++attempt;
      const {
        data: { user },
        error,
      } = await client.auth.getUser();
      if (!active || run !== attempt) return;
      if (error || !user) {
        setAuthorized(false);
        setChecking(false);
        return;
      }
      const result = await client
        .from("nx_owner")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active || run !== attempt) return;
      setAuthorized(!!result.data && !result.error);
      if (!result.data)
        setError(
          "Dieses Konto ist nicht für den Sales Hub freigeschaltet. Bitte dein bestehendes Administratorkonto verwenden.",
        );
      setChecking(false);
    }
    void authorize();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        attempt++;
        setAuthorized(false);
        setChecking(false);
      } else {
        setTimeout(() => void authorize(), 0);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [demo]);
  async function logout() {
    if (demo) {
      setDemo(false);
      history.replaceState(null, "", location.pathname);
      setChecking(true);
      return;
    }
    await client.auth.signOut({ scope: "local" });
    setAuthorized(false);
  }
  if (demo || authorized)
    return (
      <DataProvider key={demo ? "demo" : "live"} demo={demo}>
        <Shell onLogout={() => void logout()} />
      </DataProvider>
    );
  return (
    <div className="login-page">
      <div className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">DEIN VERTRIEB. EINE ZENTRALE.</span>
          <h1>
            Mehr
            <br />
            Umsatzpotenzial.
            <br />
            <span>Weniger Aufwand.</span>
          </h1>
          <p>
            Payment, Trendprodukte und starke Kundenbeziehungen.
            <br />
            Willkommen in deinem neXaro Sales Hub.
          </p>
        </div>
        <span className="login-tag">
          PEOPLE · PAYMENT · PRODUCTS · PROGRESS
        </span>
        <div className="login-x" aria-hidden="true">
          X
        </div>
      </div>
      <div className="login-panel">
        <div className="login-card">
          <div className="lock-mark">
            <LockKeyhole size={24} />
          </div>
          <span className="eyebrow">PERSÖNLICHER ARBEITSBEREICH</span>
          <h2>Bereit für deinen nächsten Abschluss?</h2>
          <p>Melde dich mit deinem bestehenden Administratorkonto an.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              const { error } = await client.auth.signInWithPassword({
                email: String(f.get("email")).trim(),
                password: String(f.get("password")),
              });
              if (error)
                setError(
                  "Anmeldung fehlgeschlagen. E-Mail und Passwort bitte prüfen.",
                );
              setBusy(false);
            }}
          >
            <Field label="E-Mail">
              <input
                autoComplete="username"
                type="email"
                name="email"
                required
              />
            </Field>
            <Field label="Passwort">
              <input
                autoComplete="current-password"
                type="password"
                name="password"
                required
              />
            </Field>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary wide" disabled={busy || checking}>
              {busy
                ? "Anmeldung läuft …"
                : checking
                  ? "Zugang wird geprüft …"
                  : "Zum Sales Hub"}{" "}
              <ArrowRight size={17} />
            </button>
          </form>
          <button
            className="demo-link"
            onClick={() => {
              history.replaceState(null, "", location.pathname + "?demo=1");
              setDemo(true);
            }}
          >
            Mit Beispieldaten ansehen <ArrowRight size={15} />
          </button>
          <p className="login-security">
            <ShieldCheck size={15} /> Persönlicher Login · Geschützte
            Kundendaten
          </p>
        </div>
      </div>
    </div>
  );
}
