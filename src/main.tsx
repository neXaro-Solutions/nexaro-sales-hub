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
import { installSelectOnFocus } from "./lib/focusInputs";
installSelectOnFocus();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
