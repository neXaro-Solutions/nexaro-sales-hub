import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, Smartphone, X } from "lucide-react";
import { client } from "../lib/client";
const VAPID = "BMY4ZImAXi6v35cNF0KhID3IXidItW0J-YEVa3xQE1Y2vZC0C7TQUr7lPgAvLO82gR_oTVwBX4Nx79pK7Tzw3Y8";
type Notice = { id:string; title:string; body:string; category:string; created_at:string; read_at:string|null; target_url:string };
function applicationKey(value:string): Uint8Array {
  const input=atob(value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4));
  return Uint8Array.from(input,c=>c.charCodeAt(0));
}
function isiOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent);}
function isStandalone(){return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);}
export function NotificationCenter({demo,navigate}:{demo:boolean;navigate:(page:string)=>void}){
  const [items,setItems]=useState<Notice[]>([]);
  const [open,setOpen]=useState(false);
  const [pushEnabled,setPushEnabled]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const supported=typeof window!=="undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const load=useCallback(async()=>{
    if(demo)return;
    const {data,error}=await client.from("nx_notifications").select("id,title,body,category,created_at,read_at,target_url").order("created_at",{ascending:false}).limit(100);
    if(!error)setItems((data||[]) as Notice[]);
  },[demo]);
  useEffect(()=>{
    if(demo)return;
    void load();
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},45000);
    const visible=()=>{if(document.visibilityState==="visible")void load();};
    document.addEventListener("visibilitychange",visible);
    return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
  },[demo,load]);
  useEffect(()=>{
    if(demo||!supported)return;
    void navigator.serviceWorker.getRegistration(new URL("./",document.baseURI).pathname).then(async registration=>{
      const sub=await registration?.pushManager.getSubscription();
      if(!sub)return;
      const {data:{user}}=await client.auth.getUser();
      if(!user)return;
      const {data}=await client.from("nx_push_subscriptions").select("endpoint").eq("user_id",user.id).eq("endpoint",sub.endpoint).maybeSingle();
      setPushEnabled(!!data);
    }).catch(()=>{});
  },[demo,supported]);
  async function enable(){
    if(busy||demo)return;
    if(!supported){setStatus("Dieser Browser unterstützt Web-Push nicht. Bitte Safari auf dem iPhone verwenden.");return;}
    if(isiOS()&&!isStandalone()){setStatus("iPhone: In Safari „Teilen“ → „Zum Home-Bildschirm“ wählen, dann neXaro CRM über das neue App-Symbol öffnen und Push aktivieren.");return;}
    setBusy(true);setStatus("");
    try{
      const permission=await Notification.requestPermission();
      if(permission!=="granted")throw Error("Mitteilungen wurden nicht freigegeben. Bitte die Mitteilungserlaubnis in den iPhone-Einstellungen prüfen.");
      const registration=await navigator.serviceWorker.register(new URL("./nx-push-sw.js",document.baseURI).href,{scope:new URL("./",document.baseURI).pathname});
      await navigator.serviceWorker.ready;
      const existing=await registration.pushManager.getSubscription();
      const sub=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(VAPID) as BufferSource});
      const json=sub.toJSON();
      if(!json.keys?.p256dh||!json.keys?.auth)throw Error("Geräteschlüssel nicht verfügbar.");
      const {data:{user},error:authError}=await client.auth.getUser();
      if(authError||!user)throw Error("Bitte erneut anmelden.");
      const {error}=await client.from("nx_push_subscriptions").upsert({user_id:user.id,endpoint:sub.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth},{onConflict:"endpoint"});
      if(error)throw Error("Gerät konnte nicht registriert werden. Bitte die Berechtigung prüfen.");
      setPushEnabled(true);setStatus("Push-Mitteilungen sind auf diesem Gerät registriert. Bitte bei iOS Mitteilungen für neXaro CRM erlauben.");
    }catch(error){setStatus(error instanceof Error?error.message:"Push-Einrichtung fehlgeschlagen.");}
    finally{setBusy(false);}
  }
  async function disable(){
    setBusy(true);setStatus("");
    try{
      const registration=await navigator.serviceWorker.getRegistration(new URL("./",document.baseURI).pathname);
      const sub=await registration?.pushManager.getSubscription();
      if(sub){
        const {error}=await client.from("nx_push_subscriptions").delete().eq("endpoint",sub.endpoint);
        if(error)throw Error("Push-Abonnement konnte nicht entfernt werden.");
        await sub.unsubscribe();
      }
      setPushEnabled(false);setStatus("Push-Mitteilungen auf diesem Gerät deaktiviert.");
    }catch(error){setStatus(error instanceof Error?error.message:"Deaktivierung fehlgeschlagen.");}
    finally{setBusy(false);}
  }
  async function mark(item:Notice){
    if(!item.read_at){
      const {error}=await client.from("nx_notifications").update({read_at:new Date().toISOString()}).eq("id",item.id);
      if(!error)setItems(current=>current.map(x=>x.id===item.id?{...x,read_at:new Date().toISOString()}:x));
    }
    setOpen(false);
    if(item.category==="inquiry")navigate("customers");
    else navigate("tasks");
  }
  async function markAll(){
    const ids=items.filter(n=>!n.read_at).map(n=>n.id);
    if(!ids.length)return;
    const at=new Date().toISOString();
    const {error}=await client.from("nx_notifications").update({read_at:at}).in("id",ids);
    if(error){setStatus("Benachrichtigungen konnten nicht aktualisiert werden.");return;}
    setItems(current=>current.map(n=>n.read_at?n:{...n,read_at:at}));
  }
  const unread=items.filter(n=>!n.read_at).length;
  return <div className="nx-notifications">
    <button type="button" className="nx-notification-button" aria-label={"Benachrichtigungen öffnen, "+unread+" ungelesen"} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      {unread?<BellRing size={19}/>:<Bell size={19}/>}
      {unread>0&&<span className="nx-notification-count">{unread>99?"99+":unread}</span>}
    </button>
    {open&&<div className="nx-notification-panel" role="region" aria-label="neXaro Benachrichtigungszentrale">
      <div className="nx-notification-panel-head"><strong>Benachrichtigungen</strong><button type="button" className="icon-button" aria-label="Schließen" onClick={()=>setOpen(false)}><X size={17}/></button></div>
      <p className="hint">Neue Anfragen sofort · Termine 60 Minuten vorher · Aufgaben bei Fälligkeit · Überfälliges täglich</p>
      {!demo&&<div className="nx-notification-push"><Smartphone size={17}/><div><strong>{pushEnabled?"iPhone Push aktiviert":"iPhone Push einrichten"}</strong><p className="hint">{pushEnabled?"Dieses Gerät empfängt Web-Push.":"Auf dem iPhone zuerst zum Home-Bildschirm hinzufügen und als App öffnen."}</p></div><button type="button" className="secondary" disabled={busy} onClick={()=>void (pushEnabled?disable():enable())}>{busy?"…":pushEnabled?"Aus":"Aktivieren"}</button></div>}
      {status&&<p role="status" className="hint">{status}</p>}
      <div className="nx-notification-panel-head"><strong>{unread} ungelesen</strong><button type="button" className="text-button" disabled={!unread||demo} onClick={()=>void markAll()}><CheckCheck size={15}/> Alle gelesen</button></div>
      <div className="nx-notification-list">
        {items.length?items.map(n=><button type="button" key={n.id} className={"nx-notification-item"+(n.read_at?"":" unread")} onClick={()=>void mark(n)}>
          <strong>{n.title}</strong><span>{n.body}</span><small>{new Date(n.created_at).toLocaleString("de-DE",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Berlin"})}</small>
        </button>):<p className="hint">Noch keine neuen Ereignisse.</p>}
      </div>
    </div>}
  </div>;
}
