import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register service worker with automatic update
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Automatically reload when update is available
      updateSW(true);
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });

  // Periodically check for updates (every 5 minutes)
  setInterval(() => {
    updateSW();
  }, 5 * 60 * 1000);
}

createRoot(document.getElementById("root")!).render(<App />);
