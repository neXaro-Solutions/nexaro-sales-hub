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

const UPDATE_MARKER="nx_update_pending";

function showVersionUpdateNotice(){
  let updatedAt="";
  try{updatedAt=sessionStorage.getItem(UPDATE_MARKER)||"";}catch{/* private browsing */}
  const url=new URL(location.href);
  const updateParam=url.searchParams.get("nx_update");
  if(!updatedAt&&!updateParam)return;

  try{sessionStorage.removeItem(UPDATE_MARKER);}catch{/* private browsing */}
  if(updateParam){
    url.searchParams.delete("nx_update");
    history.replaceState(history.state,"",url.pathname+url.search+url.hash);
  }

  const when=new Date(Number(updatedAt||updateParam||Date.now()));
  const time=Number.isFinite(when.getTime())
    ?when.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})
    :new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
  const notice=document.createElement("div");
  notice.setAttribute("role","status");
  notice.setAttribute("aria-live","polite");
  notice.textContent=`✅ Neue neXaro-Version übernommen · ${time} Uhr`;
  Object.assign(notice.style,{
    position:"fixed",top:"max(14px, env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",
    zIndex:"99999",maxWidth:"calc(100vw - 28px)",padding:"12px 18px",borderRadius:"14px",
    background:"#f1ffe0",border:"1px solid #9fd653",color:"#244b2c",fontWeight:"800",
    boxShadow:"0 10px 30px rgba(36,75,44,.18)",fontFamily:"inherit",textAlign:"center"
  });
  document.body.appendChild(notice);
  window.setTimeout(()=>notice.remove(),7000);
}

function installAutomaticVersionRefresh(){
  if(!import.meta.env.PROD)return;
  let checking=false;
  const currentModule=()=>document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src||"";
  const check=async()=>{
    if(checking||document.visibilityState==="hidden")return;
    checking=true;
    try{
      const url=new URL(location.href);
      url.searchParams.set("nx_version_check",Date.now().toString());
      url.hash="";
      const response=await fetch(url.href,{cache:"no-store",headers:{Accept:"text/html"}});
      if(!response.ok)return;
      const html=await response.text();
      const doc=new DOMParser().parseFromString(html,"text/html");
      const remoteSrc=doc.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute("src");
      const loaded=currentModule();
      if(!remoteSrc||!loaded)return;
      const remote=new URL(remoteSrc,url).href;
      if(remote!==loaded){
        const changedAt=Date.now().toString();
        try{sessionStorage.setItem(UPDATE_MARKER,changedAt);}catch{/* private browsing */}
        const refresh=new URL(location.href);
        refresh.searchParams.set("nx_update",changedAt);
        location.replace(refresh.href);
      }
    }catch{
      // Update checks must never interrupt CRM usage when the network is unavailable.
    }finally{
      checking=false;
    }
  };
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void check();});
  window.addEventListener("focus",()=>void check());
  window.setInterval(()=>void check(),5*60*1000);
}

installSelectOnFocus();
showVersionUpdateNotice();
installAutomaticVersionRefresh();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
