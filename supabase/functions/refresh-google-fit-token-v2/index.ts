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

interface TokenRecord {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  token_type: string;
  scope: string;
  created_at: string;
  updated_at: string;
  last_refreshed_at: string;
  refresh_count: number;
  is_active: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, force_refresh = false } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ 
        error: 'user_id is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the current active token for the user
    const { data: currentToken, error: tokenError } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single();

    if (tokenError && tokenError.code !== 'PGRST116') {
      console.error('Error fetching current token:', tokenError);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch current token' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no active token exists, return error
    if (!currentToken) {
      return new Response(JSON.stringify({ 
        error: 'No active Google token found. Please re-authenticate.',
        needs_reauth: true
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenRecord = currentToken as TokenRecord;
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const minutesUntilExpiry = timeUntilExpiry / (1000 * 60);

    console.log(`Token expires in ${minutesUntilExpiry.toFixed(2)} minutes`);

    // Check if token needs refresh (refresh if expires within 15 minutes or if forced)
    if (!force_refresh && minutesUntilExpiry > 15) {
      console.log('Token is still valid, no refresh needed');
      return new Response(JSON.stringify({
        success: true,
        access_token: tokenRecord.access_token,
        expires_at: tokenRecord.expires_at,
        refreshed: false,
        message: 'Token is still valid'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Refreshing Google token...');

    // Get Google client ID from environment or use a fallback
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') || Deno.env.get('VITE_GOOGLE_CLIENT_ID');
    
    if (!googleClientId) {
      console.error('Google Client ID not found in environment variables');
      return new Response(JSON.stringify({ 
        error: 'Google Client ID not configured',
        needs_reauth: true
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh the token using Google's OAuth2 endpoint
    // For web applications, we only need the client_id, not client_secret
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: googleClientId,
        refresh_token: tokenRecord.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error('Google token refresh failed:', errorText);
      
      // If refresh fails, mark token as inactive
      await supabase
        .from('google_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', tokenRecord.id);

      return new Response(JSON.stringify({ 
        error: 'Failed to refresh Google token',
        needs_reauth: true,
        details: errorText
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData: GoogleTokenResponse = await refreshResponse.json();
    console.log('Token refreshed successfully');

    // Calculate new expiration time
    const newExpiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000));

    // Update the token in the database
    const { error: updateError } = await supabase
      .from('google_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || tokenRecord.refresh_token, // Keep old refresh token if not provided
        expires_at: newExpiresAt.toISOString(),
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        last_refreshed_at: now.toISOString(),
        refresh_count: tokenRecord.refresh_count + 1,
        updated_at: now.toISOString()
      })
      .eq('id', tokenRecord.id);

    if (updateError) {
      console.error('Error updating token in database:', updateError);
      return new Response(JSON.stringify({ 
        error: 'Failed to update token in database' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Token refreshed successfully. New expiry: ${newExpiresAt.toISOString()}`);

    return new Response(JSON.stringify({
      success: true,
      access_token: tokenData.access_token,
      expires_at: newExpiresAt.toISOString(),
      refreshed: true,
      refresh_count: tokenRecord.refresh_count + 1,
      message: 'Token refreshed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in refresh-google-fit-token-v2:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
