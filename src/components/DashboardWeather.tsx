import { useEffect, useState } from "react";
import { CloudSun, MapPin, RefreshCw } from "lucide-react";
import { Card } from "../components/UI";
import { locate, locateIfGranted, type Position } from "../lib/location";

type Weather = {
  temperature: number;
  feels: number;
  code: number;
  wind: number;
  city: string;
  fetched: Date;
};
const label = (code: number) => {
  if (code === 0) return "Sonnig";
  if ([1, 2].includes(code)) return "Heiter";
  if (code === 3) return "Bewölkt";
  if ([45, 48].includes(code)) return "Neblig";
  if ([51, 53, 55, 56, 57].includes(code)) return "Nieselregen";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Regen";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Schnee";
  if ([95, 96, 99].includes(code)) return "Gewitter";
  return "Wechselhaft";
};
export function DashboardWeather() {
  const [city, setCity] = useState(() => {
    try {
      return localStorage.getItem("nx_weather_city") || "";
    } catch {
      return "";
    }
  });
  const [draft, setDraft] = useState(city);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    let active = true;
    void locateIfGranted().then((p) => {
      if (active && p) setPosition(p);
    });
    return () => {
      active = false;
    };
  }, []);
  async function useLocation() {
    setLocating(true);
    setError("");
    try {
      setPosition(await locate());
      setCity("");
      setWeather(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocating(false);
    }
  }
  useEffect(() => {
    if (!city && !position) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setLoading(false);
      setWeather(null);
      setError("Wetterabfrage dauert zu lange. Bitte erneut versuchen.");
    }, 15000);
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const geo = position
          ? null
          : await fetch(
              "https://geocoding-api.open-meteo.com/v1/search?name=" +
                encodeURIComponent(city) +
                "&count=1&language=de&format=json",
              { signal: controller.signal },
            );
        if (geo && !geo.ok)
          throw Error("Standortsuche momentan nicht erreichbar.");
        const result = geo
          ? ((await geo.json()) as {
              results?: {
                name: string;
                country?: string;
                latitude: number;
                longitude: number;
              }[];
            })
          : null;
        const location = position
          ? {
              latitude: position.lat,
              longitude: position.lng,
              name: "Mein Standort",
              country: "",
            }
          : result?.results?.[0];
        if (!location)
          throw Error("Ort nicht gefunden. Bitte Stadt genauer eingeben.");
        const url =
          "https://api.open-meteo.com/v1/forecast?latitude=" +
          location.latitude +
          "&longitude=" +
          location.longitude +
          "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto";
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw Error("Wetterdaten momentan nicht erreichbar.");
        const json = (await response.json()) as {
          current?: {
            temperature_2m: number;
            apparent_temperature: number;
            weather_code: number;
            wind_speed_10m: number;
          };
        };
        if (!json.current)
          throw Error("Keine aktuellen Wetterdaten verfügbar.");
        if (!controller.signal.aborted)
          setWeather({
            temperature: json.current.temperature_2m,
            feels: json.current.apparent_temperature,
            code: json.current.weather_code,
            wind: json.current.wind_speed_10m,
            city:
              location.name + (location.country ? ", " + location.country : ""),
            fetched: new Date(),
          });
      } catch (e) {
        if (!controller.signal.aborted) {
          setWeather(null);
          setError((e as Error).message);
        }
      } finally {
        clearTimeout(timeout);
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [city, position, revision]);
  return (
    <Card
      title="Wetter am Standort"
      eyebrow="AKTUELLE BEDINGUNGEN"
      action={
        <button
          className="text-button"
          aria-label="Wetter aktualisieren"
          disabled={(!city && !position) || loading}
          onClick={() => setRevision((x) => x + 1)}
        >
          <RefreshCw size={16} /> Aktualisieren
        </button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = draft.trim();
          if (!value) {
            setError("Bitte einen Ort eingeben.");
            return;
          }
          try {
            localStorage.setItem("nx_weather_city", value);
          } catch {
            /* storage optional */
          }
          setPosition(null);
          setCity(value);
          setRevision((x) => x + 1);
        }}
        className="button-row"
      >
        <label className="grow">
          Stadt / Einsatzgebiet
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="z. B. Berlin"
            aria-label="Wetterstandort"
          />
        </label>
        <button className="secondary" type="submit">
          <MapPin size={15} /> Anzeigen
        </button>
      </form>
      <button
        className="secondary"
        type="button"
        onClick={() => void useLocation()}
        disabled={locating}
      >
        <MapPin size={15} />{" "}
        {locating ? "Standort wird ermittelt …" : "Meinen Standort verwenden"}
      </button>
      {!city && !position && (
        <p className="muted">
          Bei bereits erteilter Browserfreigabe wird dein Standort automatisch
          ermittelt. Andernfalls kannst du ihn einmalig freigeben oder den Ort
          manuell eingeben.
        </p>
      )}
      {loading && (
        <p role="status" className="muted">
          Wetter wird geladen …
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {weather && !loading && (
        <>
          <div className="cost-row">
            <span>
              <CloudSun size={23} /> {weather.city}
              <br />
              <small>{label(weather.code)}</small>
            </span>
            <strong>{Math.round(weather.temperature)} °C</strong>
          </div>
          <div className="mini-stats">
            <div>
              <span>Gefühlt</span>
              <b>{Math.round(weather.feels)} °C</b>
            </div>
            <div>
              <span>Wind</span>
              <b>{Math.round(weather.wind)} km/h</b>
            </div>
          </div>
          <p className="hint">
            Aktualisiert:{" "}
            {weather.fetched.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · Quelle: Open-Meteo
          </p>
        </>
      )}
    </Card>
  );
}
