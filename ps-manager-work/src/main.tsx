import "./index.css";
import { installBrowserIpc } from "./lib/browserIpc";

// In a normal browser, provide the same IPC-shaped interface used by the Electron renderer.
// Electron preload already exposes window.ipcRenderer, so it is left untouched.
installBrowserIpc();
import App from "./App.tsx";

import React from "react";
import ReactDOM from "react-dom/client";

import store from "./Redux/store.ts";
import { Provider } from "react-redux";
import { HashRouter as Router } from "react-router-dom";
import ToasterProvider from "./provider/ToasterProvider.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToasterProvider />
    <Router>
      <Provider store={store}>
        <App />
      </Provider>
    </Router>
  </React.StrictMode>
);

// Remove Preload scripts loading
postMessage({ payload: "removeLoading" }, "*");
