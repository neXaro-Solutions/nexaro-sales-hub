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
        const refresh=new URL(location.href);
        refresh.searchParams.set("nx_update",Date.now().toString());
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
installAutomaticVersionRefresh();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
