/* neXaro CRM web push: no CRM data is cached. */
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const url = typeof payload.url === "string" && payload.url.startsWith("/new-nexaro-field-sales-crm/hub/") ? payload.url : "/new-nexaro-field-sales-crm/hub/";
  event.waitUntil(self.registration.showNotification(String(payload.title || "neXaro CRM"), {
    body: String(payload.body || "Ein neues Ereignis wartet auf dich."),
    icon: "./favicon.svg",
    badge: "./favicon.svg",
    tag: String(payload.eventKey || payload.title || "nexaro-event"),
    data: { url }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(w => w.url.startsWith(self.location.origin + "/new-nexaro-field-sales-crm/hub/"));
    if (existing) { await existing.focus(); await existing.navigate(target); return; }
    await clients.openWindow(target);
  })());
});
