import { useEffect, useState } from "react";
import { locate, locateIfGranted, type Position } from "../lib/location";
import {
  Search,
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
  External,
  DivisionBadge,
} from "../components/UI";
import {
  address,
  mapSearch,
  streetView,
  orderStops,
  mapsRoutes,
  today,
  dateLabel,
  distance,
  dayKey,
} from "../lib/calculations";
import { geocode, findProspects, type Prospect } from "../lib/maps";
import type { Stop, Division, Route } from "../lib/types";
export function Routes() {
  const { data, save, refresh } = useStore();
  const [day, setDay] = useState(today()),
    [origin, setOrigin] = useState(""),
    [query, setQuery] = useState(""),
    [radius, setRadius] = useState(2),
    [category, setCategory] = useState("shops"),
    [division, setDivision] = useState<Division>("sumup"),
    [results, setResults] = useState<Prospect[]>([]),
    [center, setCenter] = useState<{
      lat: number;
      lng: number;
      city: string;
    } | null>(null),
    [stops, setStops] = useState<Stop[]>([]),
    [route, setRoute] = useState<Route | undefined>(),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState("all"),
    [saved, setSaved] = useState(false),
    [myPosition, setMyPosition] = useState<Position | null>(null),
    [searchFromGps, setSearchFromGps] = useState(false);
  useEffect(() => {
    let active = true;
    void locateIfGranted().then(p => { if (active && p) { setMyPosition(p); if (!query.trim()) setSearchFromGps(true); } });
    return () => { active = false; };
  }, []);
  async function useMyLocation() {
    setBusy("location"); setMessage("");
    try {
      const p = await locate();
      setMyPosition(p);
      setSearchFromGps(true);
      setResults([]);
      setMessage("GPS-Standort als Mittelpunkt der Umkreissuche übernommen. Jetzt „Standorte suchen“ wählen.");
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(""); }
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
  async function search() {
    setBusy("search");
    setMessage("");
    try {
      const c = searchFromGps && myPosition
        ? { lat: myPosition.lat, lng: myPosition.lng, city: "GPS-Standort" }
        : await geocode(query);
      setCenter(c);
      const p = await findProspects(c, radius, category);
      setResults(p);
      if (!p.length)
        setMessage(
          "Keine Treffer in diesem Suchbereich. Branche oder Radius anpassen.",
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Suche fehlgeschlagen.");
    } finally {
      setBusy("");
    }
  }
  async function importLead(p: Prospect) {
    setBusy(p.id);
    setMessage("");
    try {
      let c = data.customers.find(
        (c) =>
          c.source === "OpenStreetMap " + p.id ||
          (c.company.toLowerCase() === p.name.toLowerCase() &&
            c.street === p.street &&
            c.city === (p.city || center?.city || "")),
      );
      if (!c) {
        c = await save("customers", {
          company: p.name,
          contact: "",
          email: "",
          phone: p.phone,
          street: p.street,
          zip: p.zip,
          city: p.city || center?.city || "",
          industry: p.category,
          source: "OpenStreetMap " + p.id,
          notes:
            "Öffentlicher Recherchetreffer. Kontaktdaten und Bedarf vor Ort prüfen.",
          lat: p.lat,
          lng: p.lng,
          ...{ interests: [division] },
        });
        await refresh();
      }
      add({
        id: c.id,
        company: c.company,
        address: address(c),
        lat: c.lat,
        lng: c.lng,
      });
      setMessage("Standort im CRM und in der Tagesroute.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function optimize() {
    setBusy("optimize");
    setMessage("");
    try {
      const start = myPosition || center || undefined;
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
            Standorte recherchieren, Tagesroute zusammenstellen und losfahren.
          </p>
        </div>
        <Badge>
          <MapPin size={13} /> Außendienst
        </Badge>
      </div>
      <div className="route-grid">
        <div>
          <Card
            title="Neue Standorte entdecken"
            eyebrow="ÖFFENTLICHE UNTERNEHMENSRECHERCHE"
          >
            <div className="form-grid">
              <button className="secondary route-gps-button" type="button" disabled={!!busy} onClick={() => void useMyLocation()}>
                <MapPin size={15} /> {busy === "location" ? "Standort wird ermittelt …" : "Meinen Standort ermitteln"}
              </button>
              {myPosition && <p className="hint route-gps-hint">Aktueller Standort erkannt (Genauigkeit ca. {Math.round(myPosition.accuracy)} m). {searchFromGps ? "Mittelpunkt der Umkreissuche, Navigation und Routensortierung." : "Für Navigation und Routensortierung verfügbar; die Ortssuche nutzt die eingegebene PLZ."} Nicht in der Kundenakte gespeichert.</p>}
              <Field label="PLZ / Ort">
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSearchFromGps(false); }}
                  placeholder="z. B. 15757 Halbe"
                />
              </Field>
              <Field label="Umkreis">
                <select
                  value={radius}
                  onChange={(e) => setRadius(+e.target.value)}
                >
                  <option value="1">1 km</option>
                  <option value="2">2 km</option>
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                  <option value="15">15 km</option>
                  <option value="20">20 km</option>
                  <option value="25">25 km</option>
                  <option value="30">30 km</option>
                </select>
              </Field>
              <Field label="Branche">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="shops">Einzelhandel</option>
                  <option value="food">Gastronomie</option>
                  <option value="vape">Kioske, Tabak & Vapes</option>
                </select>
              </Field>
              <Field label="Leads zuordnen">
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value as Division)}
                >
                  <option value="sumup">SumUp</option>
                  <option value="vape">Vapes</option>
                </select>
              </Field>
            </div>
            <div className="button-row">
              <button
                className="primary"
                onClick={() => void search()}
                disabled={!!busy || (!searchFromGps && query.trim().length < 3)}
              >
                <Search size={16} />
                {busy === "search" ? "Suche läuft …" : "Standorte suchen"}
              </button>
              {query && (
                <External
                  href={mapSearch(
                    query +
                      " " +
                      (category === "food"
                        ? "Gastronomie"
                        : category === "vape"
                          ? "Kiosk"
                          : "Einzelhandel"),
                  )}
                >
                  Google Maps Recherche
                </External>
              )}
            </div>
            <p className="hint">
              Ortssuche nur auf deinen Klick, maximal eine Anfrage pro Sekunde,
              keine automatische Massensuche. Nur öffentliche Geschäftsorte
              eingeben.{" "}
              <a
                className="text-link"
                href="https://operations.osmfoundation.org/policies/nominatim/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Nutzungsregeln der Ortssuche
              </a>
            </p>
            <p className="hint">
              Ergebnisse aus OpenStreetMap, bis zu 60 Treffer je Suche. Bei großen Radien kann die Suche länger dauern; 60 Treffer sind keine vollständige Gebietserfassung. Unvollständige
              Daten sind möglich. Google Maps ergänzt die manuelle Recherche.
            </p>
            <External href="https://www.openstreetmap.org/copyright">
              © OpenStreetMap-Mitwirkende · ODbL
            </External>
          </Card>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {results.length > 0 && (
            <Card title={`${results.length} Recherchetreffer`}>
              {results.map((p) => (
                <div className="prospect" key={p.id}>
                  <div className="grow">
                    <strong>{p.name}</strong>
                    <small>
                      {[p.street, p.zip, p.city || center?.city]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                    <small>
                      {p.category}
                      {center &&
                        " · " +
                          distance(center, p).toFixed(1) +
                          " km Luftlinie"}
                    </small>
                    <div className="button-row">
                      <External
                        href={mapSearch(
                          p.name +
                            " " +
                            p.street +
                            " " +
                            (p.city || center?.city),
                        )}
                      >
                        Maps
                      </External>
                      <External href={streetView(p.lat, p.lng)}>
                        Street View
                      </External>
                    </div>
                  </div>
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() => void importLead(p)}
                  >
                    <Plus size={15} /> Lead + Route
                  </button>
                </div>
              ))}
            </Card>
          )}
          <Card title="Deine Kunden einplanen">
            <select
              value={filter}
              aria-label="Routenkunden filtern"
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Alle Kunden</option>
              <option value="due">Fällige Wiedervorlagen</option>
              <option value="sumup">SumUp</option>
              <option value="vape">Vapes</option>
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
                Füge Kunden oder Recherchetreffer hinzu.
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
              Heuristische Reihenfolge ab aktuellem Standort, Suchgebiet oder erstem Stopp nach
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
