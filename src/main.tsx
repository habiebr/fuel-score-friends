import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.documentElement;
if (!rootElement.classList.contains("dark")) {
  rootElement.classList.add("dark");
}
rootElement.setAttribute("data-theme", "dark");

// Provide auth header to the service worker upon request
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (event: MessageEvent) => {
    if (event.data && (event as any).data.type === 'REQUEST_AUTH_HEADER' && (event as any).ports && (event as any).ports[0]) {
      try {
        // Supabase stores session under sb-<project-ref>-auth-token; use a generic fallback key if present
        const entries = Object.keys(localStorage).filter(k => k.includes('auth-token'));
        let accessToken: string | undefined = undefined;
        for (const key of entries) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key) || '{}');
            accessToken = parsed?.currentSession?.access_token || parsed?.access_token || parsed?.accessToken;
            if (accessToken) break;
          } catch {}
        }
        if (!accessToken && import.meta.env.VITE_SUPABASE_ANON_KEY) {
          accessToken = import.meta.env.VITE_SUPABASE_ANON_KEY;
        }
        (event as any).ports[0].postMessage({ accessToken });
      } catch {
        (event as any).ports[0].postMessage({ accessToken: undefined });
      }
    }
    if (event.data && (event as any).data.type === 'REQUEST_SUPABASE_ANON' && (event as any).ports && (event as any).ports[0]) {
      try {
        // Always prefer ANON key for client SDK (Realtime + REST)
        const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
        (event as any).ports[0].postMessage({ anonKey });
      } catch {
        (event as any).ports[0].postMessage({ anonKey: undefined });
      }
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
