import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./index.css";
// Side-effect import so Tailwind's scanner sees the layout-primitive utility safelist
// (Stack/Inline/Grid build gap/grid classes at runtime). Not used at runtime.
import "./lib/tw-safelist";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
