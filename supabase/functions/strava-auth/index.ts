// Strava OAuth Authentication Edge Function
// Handles OAuth callback and token exchange
// Separate from Google Fit to avoid breaking existing code

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRAVA_CLIENT_ID = Deno.env.get("VITE_STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://nutrisync.id";

console.log("=== Strava Auth Function Initialized ===");
console.log("APP_URL:", APP_URL);
console.log("STRAVA_CLIENT_ID:", STRAVA_CLIENT_ID ? "SET" : "NOT SET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    // ... other athlete fields
  };
}

serve(async (req) => {
  console.log("=== Strava Auth Request ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const scope = url.searchParams.get("scope");
    const error = url.searchParams.get("error");
    const state = url.searchParams.get("state");

    console.log("Parameters:", { 
      hasCode: !!code, 
      hasState: !!state, 
      hasError: !!error,
      scope 
    });

    // Handle OAuth errors
    if (error) {
      console.error("Strava OAuth error:", error);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${APP_URL}/profile/integrations?strava_error=${encodeURIComponent(error)}`,
        },
      });
    }

    // Validate code parameter
    if (!code) {
      console.error("Missing code parameter");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${APP_URL}/profile/integrations?strava_error=missing_code`,
        },
      });
    }

    // Get state parameter (contains user token for authentication)
    if (!state) {
      console.error("Missing state parameter");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${APP_URL}/profile/integrations?strava_error=missing_state`,
        },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Getting user from state token...");
    // Get user ID from state parameter (passed during OAuth initiation)
    const { data: { user }, error: userError } = await supabase.auth.getUser(state);

    if (userError || !user) {
      console.error("User auth error:", userError);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${APP_URL}/profile/integrations?strava_error=invalid_user`,
        },
      });
    }

    console.log(`Processing Strava auth for user: ${user.id}`);

    // Exchange authorization code for access token
    console.log("Exchanging code for tokens...");
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Strava token exchange failed:", errorText);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${APP_URL}/profile/integrations?strava_error=token_exchange_failed`,
        },
      });
    }

    const tokenData: StravaTokenResponse = await tokenResponse.json();
    console.log("Tokens received, athlete ID:", tokenData.athlete.id);

    // Store tokens in database
    console.log("Storing tokens in database...");
    const { error: dbError } = await supabase
      .from("strava_tokens")
      .upsert({
        user_id: user.id,
        athlete_id: tokenData.athlete.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
        scope: scope || "read,activity:read_all",
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${APP_URL}/profile/integrations?strava_error=database_error`,
        },
      });
    }

    console.log(`Successfully stored Strava tokens for athlete ${tokenData.athlete.id}`);
    console.log(`Redirecting to: ${APP_URL}/profile/integrations?strava_connected=true`);

    // Redirect back to app with success
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": `${APP_URL}/profile/integrations?strava_connected=true`,
      },
    });

  } catch (error) {
    console.error("Unexpected error in strava-auth:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error details:", errorMessage);
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": `${APP_URL}/profile/integrations?strava_error=internal_error`,
      },
    });
  }
});
