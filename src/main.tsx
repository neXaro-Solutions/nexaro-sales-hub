import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./light.css";
import "./access.css";
import "./call-leads.css";
import "./call-leads-ios-fix.css";
import "./call-leads-nexaro-theme.css";
import "./call-leads-email-priority.css";
import "./call-leads-efficiency.css";
import { installSelectOnFocus } from "./lib/focusInputs";

const LAST_BUILD_KEY="nx_last_loaded_build";

function loadedBuild(){
  const src=document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src||"";
  return src.split("/").pop()||src;
}
function buildLabel(build:string){
  const match=build.match(/index-([A-Za-z0-9_-]+)\.js$/);
  return match?.[1]||build.replace(/\.js$/i,"");
}
function showVersionNotice(text:string){
  const notice=document.createElement("div");
  notice.setAttribute("role","status");notice.setAttribute("aria-live","polite");notice.textContent=text;
  Object.assign(notice.style,{position:"fixed",top:"max(14px, env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",zIndex:"99999",maxWidth:"calc(100vw - 28px)",padding:"12px 18px",borderRadius:"14px",background:"#f1ffe0",border:"1px solid #9fd653",color:"#244b2c",fontWeight:"800",boxShadow:"0 10px 30px rgba(36,75,44,.18)",fontFamily:"inherit",textAlign:"center"});
  document.body.appendChild(notice);window.setTimeout(()=>notice.remove(),9000);
}
function mountPersistentVersionStatus(build:string){
  const existing=document.getElementById("nx-version-status");if(existing)existing.remove();
  const badge=document.createElement("div");badge.id="nx-version-status";
  badge.setAttribute("role","status");badge.setAttribute("aria-label",`Aktuelle CRM-Version ${buildLabel(build)}`);
  badge.textContent=`● CRM aktuell · ${buildLabel(build)}`;
  Object.assign(badge.style,{position:"fixed",right:"12px",bottom:"max(12px, env(safe-area-inset-bottom))",zIndex:"9998",padding:"7px 10px",borderRadius:"999px",background:"rgba(248,255,239,.96)",border:"1px solid #b8d892",color:"#31552f",fontSize:"12px",fontWeight:"800",lineHeight:"1",boxShadow:"0 6px 18px rgba(36,75,44,.12)",fontFamily:"inherit",pointerEvents:"none",whiteSpace:"nowrap"});
  document.body.appendChild(badge);
}
function registerLoadedBuild(){
  if(!import.meta.env.PROD)return;
  const current=loadedBuild();if(!current)return;
  mountPersistentVersionStatus(current);
  let previous="";try{previous=localStorage.getItem(LAST_BUILD_KEY)||"";}catch{/* private browsing */}
  if(previous&&previous!==current){
    const time=new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
    showVersionNotice(`✅ Neue neXaro-Version übernommen · ${time} Uhr`);
  }
  try{localStorage.setItem(LAST_BUILD_KEY,current);}catch{/* private browsing */}
}
function installAutomaticVersionRefresh(){
  if(!import.meta.env.PROD)return;
  let checking=false;
  const check=async()=>{
    if(checking||document.visibilityState==="hidden")return;checking=true;
    try{
      const url=new URL(location.href);url.searchParams.set("nx_version_check",Date.now().toString());url.hash="";
      const response=await fetch(url.href,{cache:"no-store",headers:{Accept:"text/html"}});if(!response.ok)return;
      const html=await response.text();const doc=new DOMParser().parseFromString(html,"text/html");
      const remoteSrc=doc.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute("src");const loaded=document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src||"";
      if(!remoteSrc||!loaded)return;const remote=new URL(remoteSrc,url).href;if(remote!==loaded){const refresh=new URL(location.href);refresh.searchParams.set("nx_update",Date.now().toString());location.replace(refresh.href);}
    }catch{/* version checks must never interrupt CRM usage */}finally{checking=false;}
  };
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void check();});
  window.addEventListener("focus",()=>void check());window.setInterval(()=>void check(),5*60*1000);
}

installSelectOnFocus();
registerLoadedBuild();
installAutomaticVersionRefresh();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
