import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ code: 401, message: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a user-scoped client to resolve the authenticated user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ code: 401, message: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token, refresh_token, expires_in, token_type = 'Bearer', scope } = await req.json();

    if (!access_token || !refresh_token || !expires_in) {
      return new Response(JSON.stringify({ 
        error: 'access_token, refresh_token, and expires_in are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize admin client for writes
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate expiration time
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (expires_in * 1000));

    // Store the new token (this will automatically deactivate old tokens via trigger)
    const { data: newToken, error: insertError } = await admin
      .from('google_tokens')
      .insert({
        user_id: userData.user.id,
        access_token,
        refresh_token,
        expires_at: expiresAt.toISOString(),
        token_type,
        scope: scope || 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read',
        is_active: true,
        refresh_count: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing token:', insertError);
      return new Response(JSON.stringify({ 
        error: 'Failed to store Google token',
        details: insertError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Token stored successfully for user ${userData.user.id}. Expires at: ${expiresAt.toISOString()}`);

    return new Response(JSON.stringify({
      success: true,
      token_id: newToken.id,
      expires_at: expiresAt.toISOString(),
      message: 'Token stored successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in store-google-token:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
