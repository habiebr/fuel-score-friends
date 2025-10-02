import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SupabaseDebug() {
  const [envInfo, setEnvInfo] = useState<any>({});
  const [authInfo, setAuthInfo] = useState<any>({});
  const [queryResult, setQueryResult] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      const env = {
        MODE: import.meta.env.MODE,
        PROD: import.meta.env.PROD,
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'NOT SET',
        VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'SET' : 'NOT SET',
        VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
      };
      setEnvInfo(env);

      const session = (await supabase.auth.getSession()).data.session;
      setAuthInfo({ hasSession: !!session, userId: session?.user?.id || null });

      try {
        const { data, error } = await supabase.from('profiles').select('user_id').limit(1);
        if (error) setQueryResult(`Error: ${error.message} (code: ${(error as any).code || 'n/a'})`);
        else setQueryResult(`OK: rows=${(data || []).length}`);
      } catch (e: any) {
        setQueryResult(`Thrown: ${e?.message || String(e)}`);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Supabase Debug</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-semibold">Environment</div>
              <pre className="bg-muted/30 p-3 rounded">{JSON.stringify(envInfo, null, 2)}</pre>
            </div>
            <div>
              <div className="font-semibold">Auth</div>
              <pre className="bg-muted/30 p-3 rounded">{JSON.stringify(authInfo, null, 2)}</pre>
            </div>
            <div>
              <div className="font-semibold">Simple Query</div>
              <pre className="bg-muted/30 p-3 rounded">{queryResult}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


