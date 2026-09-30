import { useEffect, useState } from "react";
import { ShieldCheck, UserPlus, Users, RefreshCw } from "lucide-react";
import { client } from "../lib/client";
import { Card, Badge } from "./UI";
import "../team-access.css";

type Role = "owner"|"admin"|"sales"|"field_sales"|"read_only";
type Member = { user_id:string; email:string; role:Role; status:"active"|"invited"|"disabled"; created_at:string };
type TeamData = { organization?:{id:string;name:string;slug:string}; members:Member[]; myRole:Role };

const roleLabel:Record<Role,string>={owner:"Owner",admin:"Admin",sales:"Vertrieb",field_sales:"Außendienst",read_only:"Nur Lesen"};
const roleHint:Record<Role,string>={owner:"Vollzugriff inklusive Teamverwaltung",admin:"Verwaltung und operative CRM-Arbeit",sales:"Kunden, Aufgaben, Chancen sowie Angebote",field_sales:"Kunden, HUNTER, Touren und Aufgaben",read_only:"CRM-Daten ansehen, keine Änderungen"};

export function TeamAccess({demo}:{demo:boolean}){
  const [team,setTeam]=useState<TeamData|null>(null);
  const [email,setEmail]=useState("");
  const [role,setRole]=useState<Role>("sales");
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  async function invoke(body:Record<string,unknown>){
    const {data,error}=await client.functions.invoke("nx-team-admin",{body});
    if(error||!data?.ok)throw Error(String(data?.error||"Teamverwaltung derzeit nicht erreichbar."));
    return data;
  }
  async function load(){
    if(demo)return;
    setBusy(true);setStatus("");
    try{setTeam(await invoke({action:"list"}) as TeamData)}catch(e){setStatus((e as Error).message)}finally{setBusy(false)}
  }
  useEffect(()=>{void load()},[demo]);

  async function invite(){
    if(!email.trim()||busy)return;
    setBusy(true);setStatus("");
    try{
      await invoke({action:"invite",email:email.trim(),role,redirectTo:location.origin+location.pathname});
      setEmail("");setStatus("✓ Einladung wurde versendet.");await load();
    }catch(e){setStatus((e as Error).message)}finally{setBusy(false)}
  }
  async function changeRole(member:Member,next:Role){
    if(busy||member.role==="owner")return;
    setBusy(true);setStatus("");
    try{await invoke({action:"set-role",userId:member.user_id,role:next});await load()}catch(e){setStatus((e as Error).message)}finally{setBusy(false)}
  }
  async function toggleMember(member:Member){
    if(busy||member.role==="owner")return;
    const next=member.status==="disabled"?"active":"disabled";
    setBusy(true);setStatus("");
    try{await invoke({action:"set-status",userId:member.user_id,status:next});await load()}catch(e){setStatus((e as Error).message)}finally{setBusy(false)}
  }

  return <Card title="Team & Zugriffe" eyebrow="ORGANISATION · ROLLEN · ZUGANG">
    {demo?<p className="hint">In der Demo werden keine Benutzerkonten verwaltet.</p>:<>
      <div className="settings-item"><Users/><div><strong>{team?.organization?.name||"neXaro Organisation"}</strong><p>Teammitglieder arbeiten innerhalb derselben Organisation. Daten anderer Organisationen bleiben durch Row-Level-Security getrennt.</p></div></div>
      <div className="settings-item"><ShieldCheck/><div><strong>Deine Rolle: {team?roleLabel[team.myRole]:"wird geladen …"}</strong><p>{team?roleHint[team.myRole]:"Zugriffsrechte werden geprüft."}</p></div></div>
      {(team?.myRole==="owner"||team?.myRole==="admin")&&<div className="nx-team-invite">
        <label>E-Mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="mitarbeiter@unternehmen.de" autoComplete="off"/></label>
        <label>Rolle<select value={role} onChange={e=>setRole(e.target.value as Role)}><option value="admin">Admin</option><option value="sales">Vertrieb</option><option value="field_sales">Außendienst</option><option value="read_only">Nur Lesen</option></select></label>
        <button className="primary" disabled={busy||!email.trim()} onClick={()=>void invite()}><UserPlus size={16}/> Mitarbeiter einladen</button>
      </div>}
      <div className="nx-team-list">
        {(team?.members||[]).map(member=><div className="settings-item" key={member.user_id}><span className="avatar">{(member.email||"NX").slice(0,2).toUpperCase()}</span><div style={{flex:1}}><strong>{member.email||"Benutzer"}</strong><p>{roleLabel[member.role]} · {member.status==="active"?"Aktiv":member.status==="invited"?"Einladung offen":"Deaktiviert"}</p></div><Badge>{roleLabel[member.role]}</Badge>{team?.myRole==="owner"&&member.role!=="owner"&&<><select aria-label={`Rolle für ${member.email}`} value={member.role} disabled={busy} onChange={e=>void changeRole(member,e.target.value as Role)}><option value="admin">Admin</option><option value="sales">Vertrieb</option><option value="field_sales">Außendienst</option><option value="read_only">Nur Lesen</option></select><button className="secondary" disabled={busy} onClick={()=>void toggleMember(member)}>{member.status==="disabled"?"Aktivieren":"Deaktivieren"}</button></> }</div>)}
      </div>
      <button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/> Team neu laden</button>
      {status&&<p role="status" className="hint">{status}</p>}
      <p className="hint">Owner-Rechte können nicht über diese Oberfläche entzogen werden. Einladungen und Rollenänderungen laufen ausschließlich serverseitig.</p>
    </>}
  </Card>;
}
