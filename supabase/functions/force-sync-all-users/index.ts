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
    const { admin_key, days = 30 } = await req.json();

    // Verify admin key for security
    if (admin_key !== Deno.env.get('ADMIN_FORCE_SYNC_KEY')) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - invalid admin key' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with active Google Fit tokens
    const { data: activeTokens, error: tokensError } = await supabase
      .from('google_tokens')
      .select('user_id, access_token, refresh_token, expires_at')
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching active tokens:', tokensError);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch active tokens' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!activeTokens || activeTokens.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No users with active Google Fit tokens found',
        synced_users: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${activeTokens.length} users with active Google Fit tokens`);

    const results = {
      total_users: activeTokens.length,
      successful_syncs: 0,
      failed_syncs: 0,
      errors: [] as string[]
    };

    // Process each user
    for (const tokenRecord of activeTokens) {
      try {
        console.log(`Processing user: ${tokenRecord.user_id}`);
        
        // Check if token needs refresh
        const now = new Date();
        const expiresAt = new Date(tokenRecord.expires_at);
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const minutesUntilExpiry = timeUntilExpiry / (1000 * 60);

        let accessToken = tokenRecord.access_token;

        // Refresh token if it expires within 15 minutes
        if (minutesUntilExpiry <= 15) {
          console.log(`Refreshing token for user ${tokenRecord.user_id}`);
          
          // Try to refresh the token using the main refresh function
          const refreshResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-all-google-tokens`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              batch_size: 1,
              threshold_minutes: 1
            })
          });

          if (refreshResponse.ok) {
            const result = await refreshResponse.json();
            if (result.successful_refreshes > 0) {
              // Get the refreshed token
              const { data: tokenData, error: tokenError } = await supabase
                .from('google_tokens')
                .select('access_token')
                .eq('user_id', tokenRecord.user_id)
                .eq('is_active', true)
                .single();

              if (!tokenError && tokenData?.access_token) {
                accessToken = tokenData.access_token;
                console.log(`Token refreshed for user ${tokenRecord.user_id}`);
              } else {
                console.error(`Failed to get refreshed token for user ${tokenRecord.user_id}`);
                results.failed_syncs++;
                results.errors.push(`User ${tokenRecord.user_id}: Failed to get refreshed token`);
                continue;
              }
            } else {
              console.error(`Token refresh returned no success for user ${tokenRecord.user_id}`);
              results.failed_syncs++;
              results.errors.push(`User ${tokenRecord.user_id}: Token refresh returned no success`);
              continue;
            }
          } else {
            console.error(`Failed to refresh token for user ${tokenRecord.user_id}`);
            results.failed_syncs++;
            results.errors.push(`User ${tokenRecord.user_id}: Token refresh failed`);
            continue;
          }
        }

        // Clear existing data for this user
        await supabase
          .from('google_fit_data')
          .delete()
          .eq('user_id', tokenRecord.user_id);

        await supabase
          .from('google_fit_sessions')
          .delete()
          .eq('user_id', tokenRecord.user_id);

        // Sync data for the specified number of days
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (days * 24 * 60 * 60 * 1000));

        // Call the existing sync function for this user
        const syncResponse = await supabase.functions.invoke('sync-all-google-fit-data', {
          body: {
            accessToken,
            days: days,
            userId: tokenRecord.user_id
          }
        });

        if (syncResponse.error) {
          console.error(`Sync failed for user ${tokenRecord.user_id}:`, syncResponse.error);
          results.failed_syncs++;
          results.errors.push(`User ${tokenRecord.user_id}: ${syncResponse.error.message}`);
        } else {
          console.log(`Sync successful for user ${tokenRecord.user_id}`);
          results.successful_syncs++;
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing user ${tokenRecord.user_id}:`, error);
        results.failed_syncs++;
        results.errors.push(`User ${tokenRecord.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('Force sync completed:', results);

    return new Response(JSON.stringify({
      success: true,
      message: 'Force sync completed',
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in force-sync-all-users:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
