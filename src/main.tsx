import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./learning.css";
import "./motion.css";
import "./flow.css";
import "./task.css";
import "./taste.css";
import "./product.css";
import "./landing.css";
import "./brand.css";
import "./teaching-experience.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
