import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function EnvDebug() {
  const { user, session } = useAuth();
  const [envInfo, setEnvInfo] = useState<any>({});
  const [connectionTest, setConnectionTest] = useState<string>('Testing...');

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

    // Test Supabase connection
    const testConnection = async () => {
      try {
        console.log('Testing Supabase connection...');
        
        // Test basic connection
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        
        if (error) {
          console.error('Supabase connection error:', error);
          setConnectionTest(`Error: ${error.message} (Code: ${error.code})`);
        } else {
          console.log('Supabase connection successful:', data);
          setConnectionTest('✅ Connected successfully!');
        }
      } catch (err) {
        console.error('Connection test failed:', err);
        setConnectionTest(`Failed: ${err}`);
      }
    };

    testConnection();
  }, []);

  return (
    <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
      <h3 className="font-semibold text-red-800 mb-2">Environment & Connection Debug</h3>
      <div className="space-y-1 text-sm">
        <div><strong>Mode:</strong> {envInfo.MODE}</div>
        <div><strong>DEV:</strong> {String(envInfo.DEV)}</div>
        <div><strong>PROD:</strong> {String(envInfo.PROD)}</div>
        <div><strong>VITE_SUPABASE_URL:</strong> {envInfo.VITE_SUPABASE_URL || 'NOT SET'}</div>
        <div><strong>VITE_SUPABASE_PUBLISHABLE_KEY:</strong> {envInfo.VITE_SUPABASE_PUBLISHABLE_KEY ? 'SET' : 'NOT SET'}</div>
        <div><strong>VITE_SUPABASE_ANON_KEY:</strong> {envInfo.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}</div>
        <div><strong>User:</strong> {user ? `Logged in (${user.id})` : 'Not logged in'}</div>
        <div><strong>Session:</strong> {session ? 'Active' : 'No session'}</div>
        <div><strong>Connection:</strong> {connectionTest}</div>
      </div>
    </div>
  );
}
