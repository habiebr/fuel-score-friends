import { useEffect, useState } from 'react';

export function EnvDebug() {
  const [envInfo, setEnvInfo] = useState<any>({});

  useEffect(() => {
    const env = {
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
      MODE: import.meta.env.MODE,
      DEV: import.meta.env.DEV,
      PROD: import.meta.env.PROD,
    };
    setEnvInfo(env);
  }, []);

  return (
    <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
      <h3 className="font-semibold text-red-800 mb-2">Environment Debug (Production)</h3>
      <div className="space-y-1 text-sm">
        <div><strong>Mode:</strong> {envInfo.MODE}</div>
        <div><strong>DEV:</strong> {String(envInfo.DEV)}</div>
        <div><strong>PROD:</strong> {String(envInfo.PROD)}</div>
        <div><strong>VITE_SUPABASE_URL:</strong> {envInfo.VITE_SUPABASE_URL || 'NOT SET'}</div>
        <div><strong>VITE_SUPABASE_PUBLISHABLE_KEY:</strong> {envInfo.VITE_SUPABASE_PUBLISHABLE_KEY ? 'SET' : 'NOT SET'}</div>
        <div><strong>VITE_SUPABASE_ANON_KEY:</strong> {envInfo.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}</div>
      </div>
    </div>
  );
}
