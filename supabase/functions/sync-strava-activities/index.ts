// Sync Strava Activities Edge Function
// Fetches and stores activities from Strava API
// Separate from Google Fit sync to avoid breaking existing code

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

interface StravaActivity {
  id: number;
  athlete: { id: number };
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  average_watts?: number;
  max_watts?: number;
  kilojoules?: number;
  suffer_score?: number;
  calories?: number;
  manual: boolean;
  trainer: boolean;
  commute: boolean;
}

async function refreshStravaToken(refreshToken: string) {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Strava token");
  }

  return await response.json();
}

async function getStravaActivities(accessToken: string, after?: number, before?: number, perPage = 30) {
  const params = new URLSearchParams({
    per_page: perPage.toString(),
  });

  if (after) params.append("after", after.toString());
  if (before) params.append("before", before.toString());

  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strava API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
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

    console.log(`Syncing Strava activities for user: ${user.id}`);

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

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    // Refresh token if expired
    if (expiresAt <= now) {
      console.log("Token expired, refreshing...");
      const refreshedToken = await refreshStravaToken(tokenData.refresh_token);
      
      accessToken = refreshedToken.access_token;

      // Update tokens in database
      await supabase
        .from("strava_tokens")
        .update({
          access_token: refreshedToken.access_token,
          refresh_token: refreshedToken.refresh_token,
          expires_at: new Date(refreshedToken.expires_at * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      console.log("Token refreshed successfully");
    }

    // Parse request body for date range
    const body = req.method === "POST" ? await req.json() : {};
    const { after, before, per_page = 30 } = body;

    // Fetch activities from Strava
    console.log(`Fetching activities (after: ${after}, before: ${before}, per_page: ${per_page})`);
    const activities: StravaActivity[] = await getStravaActivities(
      accessToken,
      after,
      before,
      per_page
    );

    console.log(`Fetched ${activities.length} activities from Strava`);

    // Store activities in database
    const insertedActivities = [];
    const errors = [];

    for (const activity of activities) {
      try {
        const { error: insertError } = await supabase
          .from("strava_activities")
          .upsert({
            user_id: user.id,
            activity_id: activity.id,
            athlete_id: activity.athlete.id,
            name: activity.name,
            type: activity.type,
            sport_type: activity.sport_type,
            start_date: activity.start_date,
            start_date_local: activity.start_date_local,
            timezone: activity.timezone,
            start_latlng: activity.start_latlng 
              ? `POINT(${activity.start_latlng[0]} ${activity.start_latlng[1]})`
              : null,
            end_latlng: activity.end_latlng
              ? `POINT(${activity.end_latlng[0]} ${activity.end_latlng[1]})`
              : null,
            distance: activity.distance,
            moving_time: activity.moving_time,
            elapsed_time: activity.elapsed_time,
            total_elevation_gain: activity.total_elevation_gain,
            average_speed: activity.average_speed,
            max_speed: activity.max_speed,
            average_heartrate: activity.average_heartrate,
            max_heartrate: activity.max_heartrate,
            average_cadence: activity.average_cadence,
            average_watts: activity.average_watts,
            max_watts: activity.max_watts,
            kilojoules: activity.kilojoules,
            suffer_score: activity.suffer_score,
            calories: activity.calories,
            manual: activity.manual,
            trainer: activity.trainer,
            commute: activity.commute,
            raw_data: activity,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "user_id,activity_id"
          });

        if (insertError) {
          console.error(`Error inserting activity ${activity.id}:`, insertError);
          errors.push({ activity_id: activity.id, error: insertError.message });
        } else {
          insertedActivities.push(activity.id);
        }
      } catch (err) {
        console.error(`Unexpected error for activity ${activity.id}:`, err);
        errors.push({ 
          activity_id: activity.id, 
          error: err instanceof Error ? err.message : "Unknown error" 
        });
      }
    }

    console.log(`Successfully synced ${insertedActivities.length} activities`);
    if (errors.length > 0) {
      console.error(`Encountered ${errors.length} errors during sync`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: insertedActivities.length,
        total_fetched: activities.length,
        errors: errors,
        activities: activities.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          distance: a.distance,
          start_date: a.start_date,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error in sync-strava-activities:", error);
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
