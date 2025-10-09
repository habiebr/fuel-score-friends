import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting comprehensive Google Fit sync for all users...');

    // Get all users with active Google Fit tokens
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('google_tokens')
      .select('user_id, access_token, expires_at')
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch Google Fit tokens'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No active Google Fit tokens found',
        users_processed: 0
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`Found ${tokens.length} users with active Google Fit tokens`);

    const results = {
      total_users: tokens.length,
      successful_syncs: 0,
      failed_syncs: 0,
      errors: [] as string[]
    };

    // Process each user
    for (const token of tokens) {
      try {
        console.log(`Syncing Google Fit data for user ${token.user_id}...`);

        // Call the existing sync function for this user
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-all-google-fit-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            accessToken: token.access_token,
            userId: token.user_id,
            days: 30 // Sync last 30 days
          })
        });

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          console.log(`Successfully synced user ${token.user_id}:`, syncResult);
          results.successful_syncs++;
        } else {
          const errorText = await syncResponse.text();
          console.error(`Failed to sync user ${token.user_id}:`, errorText);
          results.failed_syncs++;
          results.errors.push(`User ${token.user_id}: ${errorText}`);
        }

        // Add a small delay between users to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing user ${token.user_id}:`, error);
        results.failed_syncs++;
        results.errors.push(`User ${token.user_id}: ${error.message}`);
      }
    }

    console.log('Comprehensive sync completed:', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Comprehensive Google Fit sync completed`,
      ...results
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error in comprehensive sync function:', error);
    return new Response(JSON.stringify({
      error: error?.message || String(error)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
