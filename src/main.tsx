import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Earlier versions cached Supabase API responses in this cache. They are no longer
// used; delete them so old task data does not linger on the device.
if ('caches' in window) {
  caches.delete('supabase-cache').catch(() => {});
}

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
