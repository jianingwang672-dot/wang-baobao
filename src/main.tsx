import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DiaryProvider } from "./lib/DiaryContext";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DiaryProvider>
      <App />
    </DiaryProvider>
  </React.StrictMode>,
);
