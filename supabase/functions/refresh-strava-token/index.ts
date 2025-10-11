// Refresh Strava Token Edge Function
// Auto-refreshes expired Strava OAuth tokens
// Separate from Google Fit to avoid breaking existing code

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRAVA_CLIENT_ID = Deno.env.get("VITE_STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StravaRefreshResponse {
  token_type: string;
  access_token: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get user from authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from JWT token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Refreshing Strava token for user: ${user.id}`);

    // Get stored tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from("strava_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token fetch error:", tokenError);
      return new Response(
        JSON.stringify({ 
          error: "no_token", 
          message: "No Strava token found. Please authenticate first." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is actually expired
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    if (expiresAt > now) {
      console.log("Token is still valid, no refresh needed");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Token is still valid",
          expires_at: tokenData.expires_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh the token
    console.log("Token expired, requesting refresh from Strava...");
    const refreshResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error("Token refresh failed:", errorText);
      return new Response(
        JSON.stringify({ 
          error: "refresh_failed", 
          message: "Failed to refresh Strava token",
          details: errorText
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refreshData: StravaRefreshResponse = await refreshResponse.json();

    // Update tokens in database
    const { error: updateError } = await supabase
      .from("strava_tokens")
      .update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update tokens:", updateError);
      return new Response(
        JSON.stringify({ 
          error: "database_error", 
          message: "Failed to update tokens",
          details: updateError.message
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Token refreshed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Token refreshed successfully",
        expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error in refresh-strava-token:", error);
    return new Response(
      JSON.stringify({ 
        error: "internal_error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
