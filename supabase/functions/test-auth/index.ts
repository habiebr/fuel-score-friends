import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log all headers for debugging
    const headersLog = {};
    for (const [key, value] of req.headers.entries()) {
      headersLog[key] = value;
    }
    console.log('Request headers:', headersLog);

    // Parse request body first
    let body;
    try {
      const bodyText = await req.text();
      console.log('Raw request body:', bodyText);
      body = JSON.parse(bodyText);
      console.log('Parsed body:', body);
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin key before anything else
    const adminKey = body?.admin_key;
    const expectedAdminKey = Deno.env.get('ADMIN_FORCE_SYNC_KEY');
    console.log('Admin key check:', {
      hasAdminKey: !!adminKey,
      hasExpectedKey: !!expectedAdminKey,
      keysMatch: adminKey === expectedAdminKey
    });

    if (adminKey === expectedAdminKey) {
      return new Response(
        JSON.stringify({ 
          message: 'Admin access granted', 
          success: true,
          env: {
            hasUrl: !!Deno.env.get('SUPABASE_URL'),
            hasAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
            hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
            hasAdminKey: !!Deno.env.get('ADMIN_FORCE_SYNC_KEY')
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header (case-insensitive)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');

    // Verify JWT token
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Auth result:', { hasUser: !!user, hasError: !!userError });
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Invalid token', details: userError }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Test response for valid JWT
      return new Response(
        JSON.stringify({ message: 'JWT authentication successful', user_id: user.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Auth verification error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to verify authentication', details: error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});