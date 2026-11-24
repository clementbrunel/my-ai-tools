import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/base.css";
import "./app.css";
import { App } from "./App";
import { language } from "@cbl-log/shared";

document.documentElement.lang = language(); // index.html says "fr"
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
