import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

async function getLocalTimeInfo() {
  try {
    const res = await fetch('/timezone', { method: 'GET' });
    if (!res.ok) return { timezone: 'UTC', localHour: new Date().getUTCHours() };
    const data = await res.json();
    const hour = Number(data?.local?.hour ?? new Date().getUTCHours());
    return { timezone: data?.timezone || 'UTC', localHour: hour };
  } catch {
    return { timezone: 'UTC', localHour: new Date().getUTCHours() };
  }
}

export function useMealCron() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const schedule = async () => {
      const { localHour } = await getLocalTimeInfo();
      if (cancelled) return;

      const checkAndRun = async () => {
        const { localHour: h } = await getLocalTimeInfo();
        if (h === 6) {
          try {
            const today = new Date().toISOString().split('T')[0];
            const session = (await supabase.auth.getSession()).data.session;
            const apiKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
            await supabase.functions.invoke('generate-meal-plan-range', {
              body: { startDate: today, weeks: 7 },
              headers: {
                ...(apiKey ? { apikey: apiKey } : {}),
                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
              },
            });
          } catch (e) {
            // ignore transient errors; will retry next hour
          }
        }
      };

      await checkAndRun();
      timerRef.current = window.setInterval(checkAndRun, 60 * 60 * 1000) as unknown as number;
    };

    schedule();

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);
}


