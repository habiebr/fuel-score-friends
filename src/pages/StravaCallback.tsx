import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function StravaCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const session = (await supabase.auth.getSession()).data.session;
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!session || !code) {
        navigate('/profile');
        return;
      }
      try {
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL?.replace('.co', '.co/functions/v1')}/strava-auth?action=callback&code=${encodeURIComponent(code)}`;
        const res = await fetch(fnUrl, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          navigate('/profile');
        } else {
          navigate('/profile');
        }
      } catch {
        navigate('/profile');
      }
    })();
  }, [navigate]);

  return null;
}


