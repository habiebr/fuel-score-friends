// Strava Webhook Handler Edge Function
// Receives and processes webhook events from Strava
// Separate from Google Fit to avoid breaking existing code

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRAVA_VERIFY_TOKEN = Deno.env.get("STRAVA_VERIFY_TOKEN") || "STRAVA_WEBHOOK_VERIFY";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StravaWebhookEvent {
  object_type: string; // "activity" or "athlete"
  object_id: number;
  aspect_type: string; // "create", "update", "delete"
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, any>;
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Handle webhook subscription verification (GET request)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("Webhook verification request:", { mode, token, challenge });

    if (mode === "subscribe" && token === STRAVA_VERIFY_TOKEN) {
      console.log("Webhook verification successful");
      return new Response(JSON.stringify({ "hub.challenge": challenge }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.error("Webhook verification failed");
    return new Response("Forbidden", { status: 403 });
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Handle webhook events (POST request)
  if (req.method === "POST") {
    try {
      const event: StravaWebhookEvent = await req.json();

      console.log("Received Strava webhook event:", {
        object_type: event.object_type,
        object_id: event.object_id,
        aspect_type: event.aspect_type,
        owner_id: event.owner_id,
      });

      // Store event in database
      const { error: insertError } = await supabase
        .from("strava_webhook_events")
        .insert({
          object_type: event.object_type,
          object_id: event.object_id,
          aspect_type: event.aspect_type,
          owner_id: event.owner_id,
          subscription_id: event.subscription_id,
          event_time: new Date(event.event_time * 1000).toISOString(),
          raw_data: event,
          processed: false,
        });

      if (insertError) {
        console.error("Failed to store webhook event:", insertError);
        return new Response(
          JSON.stringify({ error: "database_error", message: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Process the event based on type
      if (event.object_type === "activity") {
        await processActivityEvent(supabase, event);
      } else if (event.object_type === "athlete") {
        await processAthleteEvent(supabase, event);
      }

      console.log("Webhook event processed successfully");

      return new Response(
        JSON.stringify({ success: true, event_time: event.event_time }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response(
        JSON.stringify({ 
          error: "processing_error", 
          message: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

async function processActivityEvent(supabase: any, event: StravaWebhookEvent) {
  const { aspect_type, object_id, owner_id } = event;

  console.log(`Processing activity event: ${aspect_type} for activity ${object_id}`);

  // Get user_id from athlete_id
  const { data: tokenData } = await supabase
    .from("strava_tokens")
    .select("user_id, access_token, refresh_token, expires_at")
    .eq("athlete_id", owner_id)
    .single();

  if (!tokenData) {
    console.error(`No token found for athlete ${owner_id}`);
    return;
  }

  if (aspect_type === "create" || aspect_type === "update") {
    // Fetch the activity details from Strava and sync
    // This would trigger the sync-strava-activities function
    console.log(`Activity ${object_id} needs to be synced`);
    // TODO: Trigger sync for this specific activity
  } else if (aspect_type === "delete") {
    // Delete the activity from our database
    const { error: deleteError } = await supabase
      .from("strava_activities")
      .delete()
      .eq("activity_id", object_id)
      .eq("user_id", tokenData.user_id);

    if (deleteError) {
      console.error("Failed to delete activity:", deleteError);
    } else {
      console.log(`Activity ${object_id} deleted successfully`);
    }
  }

  // Mark event as processed
  await supabase
    .from("strava_webhook_events")
    .update({ 
      processed: true, 
      processed_at: new Date().toISOString() 
    })
    .eq("object_id", object_id)
    .eq("owner_id", owner_id)
    .eq("aspect_type", aspect_type);
}

async function processAthleteEvent(supabase: any, event: StravaWebhookEvent) {
  const { aspect_type, owner_id } = event;

  console.log(`Processing athlete event: ${aspect_type} for athlete ${owner_id}`);

  if (aspect_type === "update") {
    // Athlete updated their settings/profile
    console.log("Athlete profile updated - no action needed");
  } else if (aspect_type === "delete") {
    // Athlete deauthorized the application
    console.log(`Athlete ${owner_id} deauthorized - removing tokens`);
    
    const { error: deleteError } = await supabase
      .from("strava_tokens")
      .delete()
      .eq("athlete_id", owner_id);

    if (deleteError) {
      console.error("Failed to delete tokens:", deleteError);
    } else {
      console.log(`Tokens for athlete ${owner_id} deleted successfully`);
    }
  }

  // Mark event as processed
  await supabase
    .from("strava_webhook_events")
    .update({ 
      processed: true, 
      processed_at: new Date().toISOString() 
    })
    .eq("owner_id", owner_id)
    .eq("aspect_type", aspect_type);
}
