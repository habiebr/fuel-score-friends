import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { handleAuth } from '../_shared/auth.ts';

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await handleAuth(req);
  
  // If auth returned a Response, it means there was an error
  if (auth instanceof Response) {
    return auth;
  }

  // Auth successful, return appropriate response
  return new Response(
    JSON.stringify({
      message: auth.isAdmin ? 'Admin operation successful' : 'Operation successful',
      user_id: auth.user.id,
      admin: auth.isAdmin,
      env: {
        hasUrl: !!Deno.env.get('SUPABASE_URL'),
        hasAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
        hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        hasAdminKey: !!Deno.env.get('ADMIN_FORCE_SYNC_KEY')
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});