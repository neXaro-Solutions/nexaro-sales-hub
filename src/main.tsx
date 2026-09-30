import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./light.css";
import "./ux.css";
import { installSelectOnFocus } from "./lib/focusInputs";
installSelectOnFocus();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
