import { useEffect, useState } from "react";
import { locate, locateIfGranted, type Position } from "../lib/location";
import { client } from "../lib/client";
import {
  MapPin,
  Plus,
  ArrowUp,
  ArrowDown,
  X,
  Navigation,
  Save,
  Route as RouteIcon,
} from "lucide-react";
import { useStore } from "../lib/store";
import {
  Card,
  Field,
  Badge,
  Empty,
} from "../components/UI";
import {
  address,
  orderStops,
  mapsRoutes,
  today,
  dateLabel,
  dayKey,
} from "../lib/calculations";
import type { Stop, Route } from "../lib/types";
type HunterStop = {id:string;company:string;street:string;zip:string;city:string;lat:number;lng:number;status:string;customer_id:string|null;note:string};
const hunterAddress=(x:HunterStop)=>[x.street,[x.zip,x.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
export function Routes() {
  const { data, save, demo } = useStore();
  const [day, setDay] = useState(today()),
    [origin, setOrigin] = useState(""),
    [stops, setStops] = useState<Stop[]>([]),
    [route, setRoute] = useState<Route | undefined>(),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState("all"),
    [saved, setSaved] = useState(false),
    [myPosition, setMyPosition] = useState<Position | null>(null),
    [hunterLeads, setHunterLeads] = useState<HunterStop[]>([]),
    [hunterFilter, setHunterFilter] = useState("Alle");
  async function loadHunter(){
    if(demo){setHunterLeads([]);return}
    const {data:rows,error}=await client.from("nx_hunter_prospects").select("id,company,street,zip,city,lat,lng,status,customer_id,note").order("updated_at",{ascending:false}).limit(500);
    if(error)throw Error("Hunter-Merkliste nicht erreichbar. Bitte erneut laden.");
    setHunterLeads((rows||[]) as HunterStop[]);
  }
  useEffect(() => {
    let active = true;
    void locateIfGranted().then(p => { if (active && p) setMyPosition(p); });
    return () => { active = false; };
  }, []);
  useEffect(()=>{let active=true;void loadHunter().catch(e=>{if(active)setMessage((e as Error).message)});return()=>{active=false}},[]);
  async function useMyLocation(){
    setBusy("location");setMessage("");
    try{const p=await locate();setMyPosition(p);setMessage("Standort für die Routensortierung ermittelt (Genauigkeit ca. "+Math.round(p.accuracy)+" m).");}
    catch(e){setMessage((e as Error).message)}
    finally{setBusy("")}
  }
  const routeOrigin = origin.trim() || (myPosition ? `${myPosition.lat},${myPosition.lng}` : "");
  const links = mapsRoutes(stops, routeOrigin);
  const customers = data.customers.filter(
    (c) =>
      filter === "all" ||
      (filter === "due"
        ? data.tasks.some(
            (t) => t.customer_id === c.id && !t.done && dayKey(t.due_at) <= day,
          )
        : data.opportunities.some(
            (o) => o.customer_id === c.id && o.division === filter,
          )),
  );
  const add = (s: Stop) => {
    if (stops.some((x) => x.id === s.id)) {
      setMessage("Dieser Standort ist bereits eingeplant.");
      return;
    }
    if (stops.length >= 40) {
      setMessage("Bitte maximal 40 Stopps je Tag planen.");
      return;
    }
    setStops((v) => [...v, s]);
    setSaved(false);
  };
  async function optimize() {
    setBusy("optimize");
    setMessage("");
    try {
      const start = myPosition || undefined;
      setStops((v) => orderStops(v, start));
      setSaved(false);
      setMessage(
        "Nach Luftliniennähe sortiert. Fahrzeiten und Öffnungszeiten bitte prüfen.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="section-intro">
        <div>
          <h1>Mehr Besuche. Weniger Umwege.</h1>
          <p>
            Hunter-Leads und bestehende Kunden zu einer Besuchstour zusammenstellen.
          </p>
        </div>
        <Badge>
          <MapPin size={13} /> Außendienst
        </Badge>
      </div>
      <div className="route-grid">
        <div>
          <Card title="1 · Hunter-Leads zur Route hinzufügen" eyebrow="NEUKUNDENGEWINNUNG · SUMUP">
            <p className="hint">Neue Geschäfte suchst und qualifizierst du nur noch im Menü „neXaro HUNTER“. Vorgemerkte Standorte lassen sich hier ohne doppelte Kundenakte zur Route hinzufügen.</p>
            <div className="button-row">
              <button className="secondary" disabled={!!busy||demo} type="button" onClick={()=>void loadHunter().then(()=>setMessage("Hunter-Merkliste aktualisiert.")).catch(e=>setMessage((e as Error).message))}>Hunter-Leads aktualisieren</button>
              <button className="secondary" disabled={!!busy} type="button" onClick={()=>void useMyLocation()}><MapPin size={15}/> Aktueller GPS-Standort</button>
            </div>
            <Field label="Hunter-Status">
              <select value={hunterFilter} onChange={e=>setHunterFilter(e.target.value)}>
                {["Alle","Neu","Vorbereitet","Besucht","Interesse","Wiedervorlage"].map(x=><option key={x}>{x}</option>)}
              </select>
            </Field>
            {hunterLeads.filter(l=>!["Kein Interesse","Übernommen"].includes(l.status)&&(hunterFilter==="Alle"||l.status===hunterFilter)).map(l=>{
              const id=l.customer_id||"hunter:"+l.id;
              const planned=stops.some(st=>st.id===id||st.id==="hunter:"+l.id);
              return <div className="prospect" key={l.id}>
                <div className="grow">
                  <strong>{l.company}</strong>
                  <small>{hunterAddress(l)||"Adresse bitte vor Ort prüfen"} · {l.status}</small>
                  {l.note&&<small>{l.note}</small>}
                </div>
                <button className="secondary" disabled={planned||!!busy} onClick={()=>add({id,company:l.company,address:hunterAddress(l),lat:l.lat,lng:l.lng})}>
                  <Plus size={15}/>{planned?" Eingeplant":" Zur Route"}
                </button>
              </div>;
            })}
            {!hunterLeads.some(l=>!["Kein Interesse","Übernommen"].includes(l.status))&&<Empty title="Noch keine Hunter-Leads">Öffne neXaro HUNTER, suche Geschäfte und merke passende Standorte vor. Bereits gespeicherte Tagesrouten bleiben erhalten.</Empty>}
            <p className="hint">Hunter-Merkliste: nur persönlich vorgemerkte Geschäfte. Für Angebote und Termine muss der Lead in die zentrale Kundenakte übernommen werden.</p>
          </Card>
          {message&&<p className="notice" role="status">{message}</p>}
          <Card title="2 · Bestehende Kunden zur Route hinzufügen">
            <select
              value={filter}
              aria-label="Routenkunden filtern"
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Alle Kunden</option>
              <option value="due">Fällige Wiedervorlagen</option>
            </select>
            {customers.length ? (
              customers.map((c) => (
                <div className="prospect" key={c.id}>
                  <div className="grow">
                    <strong>{c.company}</strong>
                    <small>{address(c)}</small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={c.company + " einplanen"}
                    disabled={stops.some((s) => s.id === c.id)}
                    onClick={() =>
                      add({
                        id: c.id,
                        company: c.company,
                        address: address(c),
                        lat: c.lat,
                        lng: c.lng,
                      })
                    }
                  >
                    <Plus size={18} />
                  </button>
                </div>
              ))
            ) : (
              <Empty title="Noch keine passenden Standorte" />
            )}
          </Card>
        </div>
        <div className="route-sidebar">
          <Card
            title="Deine Tagesroute"
            eyebrow={`${stops.length} STOPPS GEPLANT`}
          >
            <Field label="Besuchstag">
              <input
                type="date"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value);
                  setRoute(undefined);
                  setSaved(false);
                }}
              />
            </Field>
            <Field label="Startadresse (optional)">
              <input
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value);
                  setSaved(false);
                }}
                placeholder={myPosition ? "Aktueller Standort (automatisch)" : "Startpunkt für die Navigation"}
              />
            </Field>
            {stops.length ? (
              <ol className="stops">
                {stops.map((s, i) => (
                  <li key={s.id}>
                    <span className="stop-number">{i + 1}</span>
                    <div className="grow">
                      <strong>{s.company}</strong>
                      <small>{s.address}</small>
                    </div>
                    <div className="stop-actions">
                      <button
                        className="icon-button"
                        disabled={i === 0}
                        aria-label={s.company + " nach oben"}
                        onClick={() => {
                          setStops((v) => {
                            const a = [...v];
                            [a[i - 1], a[i]] = [a[i], a[i - 1]];
                            return a;
                          });
                          setSaved(false);
                        }}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="icon-button"
                        disabled={i === stops.length - 1}
                        aria-label={s.company + " nach unten"}
                        onClick={() => {
                          setStops((v) => {
                            const a = [...v];
                            [a[i + 1], a[i]] = [a[i], a[i + 1]];
                            return a;
                          });
                          setSaved(false);
                        }}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={s.company + " entfernen"}
                        onClick={() => {
                          setStops((v) => v.filter((x) => x.id !== s.id));
                          setSaved(false);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty title="Dein Tag nimmt Form an">
                Füge Kunden oder Hunter-Leads hinzu.
              </Empty>
            )}
            <button
              className="secondary wide"
              disabled={stops.length < 2 || !!busy}
              onClick={() => void optimize()}
            >
              <RouteIcon size={16} /> Nach Nähe sortieren
            </button>
            <p className="hint">
              Heuristische Reihenfolge ab aktuellem GPS-Standort oder erstem Stopp nach
              Luftlinie. Eine manuell eingegebene Startadresse hat bei der Navigation Vorrang vor GPS.
              Ohne Verkehrsdaten; Stopps ohne Koordinaten bleiben am Ende.
              Besuchsdauer und Öffnungszeiten selbst berücksichtigen.
            </p>
            <button
              className="primary wide"
              disabled={!day || !stops.length || !!busy}
              onClick={async () => {
                setBusy("save");
                setMessage("");
                try {
                  const existing =
                    route || data.routes.find((r) => r.day === day);
                  if (existing && !route)
                    throw Error(
                      "Für diesen Tag gibt es bereits eine Route. Bitte zuerst unten laden.",
                    );
                  const r = await save("routes", {
                    ...existing,
                    day,
                    origin,
                    stops,
                    name: "Tagesroute " + dateLabel(day),
                  });
                  setRoute(r);
                  setSaved(true);
                  setMessage("Tagesroute gespeichert.");
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy("");
                }
              }}
            >
              <Save size={16} />
              {saved ? "Gespeichert" : "Tagesroute speichern"}
            </button>
            {links.map((url, i) => (
              <a
                className="navigation-link"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                key={i}
              >
                <Navigation size={16} />
                {links.length > 1
                  ? `Etappe ${i + 1} · Stopps ${i * 4 + 1}–${Math.min(stops.length, (i + 1) * 4)}`
                  : "In Google Maps navigieren"}
              </a>
            ))}
            {links.length > 1 && (
              <p className="hint">
                Mobile Navigation wird in Etappen mit bis zu vier Zielen
                aufgeteilt. So bleibt jeder Stopp enthalten.
              </p>
            )}
          </Card>
          <Card title="Gespeicherte Routen">
            {data.routes.length ? (
              data.routes
                .slice()
                .sort((a, b) => b.day.localeCompare(a.day))
                .map((r) => (
                  <button
                    className="saved-route"
                    key={r.id}
                    onClick={() => {
                      setRoute(r);
                      setDay(r.day);
                      setOrigin(r.origin);
                      setStops(r.stops);
                      setSaved(true);
                    }}
                  >
                    <span>{r.name}</span>
                    <small>{r.stops.length} Stopps</small>
                  </button>
                ))
            ) : (
              <p className="muted">Noch keine Tagesroute gespeichert.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
