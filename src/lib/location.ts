export type Position = { lat: number; lng: number; accuracy: number };
export function locate(): Promise<Position> {
  if (!window.isSecureContext || !navigator.geolocation)
    return Promise.reject(Error("Standortermittlung benötigt HTTPS und einen Browser mit Standortfreigabe."));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      error => reject(Error(error.code === 1
        ? "Standortzugriff abgelehnt. Bitte in den Browser-Einstellungen erlauben oder Ort manuell eingeben."
        : error.code === 3 ? "Standortabfrage hat zu lange gedauert. Bitte erneut versuchen."
        : "Standort nicht verfügbar. Bitte GPS aktivieren oder Ort manuell eingeben.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}
/** Automatic detection only after the browser has already granted permission. */
export async function locateIfGranted(): Promise<Position | null> {
  if (!window.isSecureContext || !navigator.geolocation || !navigator.permissions) return null;
  try {
    const permission = await navigator.permissions.query({ name: "geolocation" });
    if (permission.state !== "granted") return null;
    return await locate();
  } catch { return null; }
}
