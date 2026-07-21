import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { TurnoProvider } from "./lib/turno";
import App from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TurnoProvider>
          <App />
        </TurnoProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
