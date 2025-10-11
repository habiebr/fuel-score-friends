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

interface TokenRefreshResult {
  user_id: string;
  success: boolean;
  error?: string;
  needs_reauth?: boolean;
  expires_at?: string;
  refresh_count?: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request parameters if provided, otherwise use defaults
    let batch_size = 50;  // Process 50 tokens at a time by default
    let threshold_minutes = 30;  // Refresh tokens expiring within 30 minutes
    
    try {
      const body = await req.json();
      batch_size = body.batch_size ?? batch_size;
      threshold_minutes = body.threshold_minutes ?? threshold_minutes;
    } catch {
      // Ignore JSON parsing errors and use defaults
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get settings from app_settings table
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['google_client_id', 'google_client_secret']);

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    const settingsMap = Object.fromEntries((settings || []).map((s: { key: string, value: string }) => [s.key, s.value]));
    const googleClientId = settingsMap.google_client_id;
    const googleClientSecret = settingsMap.google_client_secret;

    if (!googleClientId || !googleClientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Calculate the threshold timestamp
    const now = new Date();
    const thresholdTime = new Date(now.getTime() + (threshold_minutes * 60 * 1000));

    // Fetch tokens that need refresh
    const { data: tokensToRefresh, error: fetchError } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('is_active', true)
      .lt('expires_at', thresholdTime.toISOString())
      .order('expires_at', { ascending: true })
      .limit(batch_size);

    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }

    if (!tokensToRefresh?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens need refresh at this time',
        tokens_processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${tokensToRefresh.length} tokens...`);

    // Process each token
    const results = await Promise.all(tokensToRefresh.map(async (token: TokenRecord) => {
      try {
        // Refresh the token using Google's OAuth2 endpoint
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: token.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error(`Token refresh failed for user ${token.user_id}:`, errorText);
          
          // Mark token as inactive
          await supabase
            .from('google_tokens')
            .update({ 
              is_active: false, 
              updated_at: now.toISOString() 
            })
            .eq('id', token.id);

          return {
            user_id: token.user_id,
            success: false,
            error: errorText,
            needs_reauth: true
          };
        }

        const tokenData: GoogleTokenResponse = await refreshResponse.json();
        const newExpiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000));

        // Update the token in the database
        const { error: updateError } = await supabase
          .from('google_tokens')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || token.refresh_token,
            expires_at: newExpiresAt.toISOString(),
            token_type: tokenData.token_type,
            scope: tokenData.scope,
            last_refreshed_at: now.toISOString(),
            refresh_count: token.refresh_count + 1,
            updated_at: now.toISOString()
          })
          .eq('id', token.id);

        if (updateError) {
          throw new Error(`Failed to update token: ${updateError.message}`);
        }

        return {
          user_id: token.user_id,
          success: true,
          expires_at: newExpiresAt.toISOString(),
          refresh_count: token.refresh_count + 1
        };

      } catch (error) {
        console.error(`Error processing token for user ${token.user_id}:`, error);
        return {
          user_id: token.user_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }));

    // Summarize results
    const successful = results.filter((r: TokenRefreshResult) => r.success).length;
    const failed = results.filter((r: TokenRefreshResult) => !r.success).length;
    const needsReauth = results.filter((r: TokenRefreshResult) => r.needs_reauth).length;

    // Log results to refresh_logs table if it exists
    try {
      await supabase
        .from('refresh_logs')
        .insert({
          batch_size,
          threshold_minutes,
          tokens_processed: results.length,
          successful_refreshes: successful,
          failed_refreshes: failed,
          needs_reauth: needsReauth,
          details: results
        });
    } catch (logError) {
      console.warn('Failed to write to refresh_logs:', logError);
      // Non-critical error, continue
    }

    return new Response(JSON.stringify({
      success: true,
      tokens_processed: results.length,
      successful_refreshes: successful,
      failed_refreshes: failed,
      needs_reauth: needsReauth,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in refresh-all-google-tokens:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
