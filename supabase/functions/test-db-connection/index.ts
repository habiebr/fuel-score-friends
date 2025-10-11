import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

// Use environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://eecdbddpzwedficnpenm.supabase.co';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      'https://eecdbddpzwedficnpenm.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Get all tokens
    const { data: allTokens, error: tokensError } = await supabase
      .from('google_tokens')
      .select('*');

    console.log('All tokens:', allTokens);

    // Get specific user's token
    const userId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
    const { data: userToken, error: userTokenError } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    console.log('Token query results:', {
      totalTokens: allTokens?.length ?? 0,
      tokensError,
      activeUserToken: userToken,
      userTokenError
    });

    return new Response(
      JSON.stringify({
        message: 'Token check results',
        totalTokens: allTokens?.length ?? 0,
        hasValidToken: userToken != null && !userTokenError,
        activeUserToken: userToken,
        userTokenError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});