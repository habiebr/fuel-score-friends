// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    ...init,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const VERIFY_TOKEN = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN") ?? "";

  try {
    if (req.method === "GET") {
      // Strava webhook challenge
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
        return json({ "hub.challenge": challenge });
      }
      return json({ error: "Invalid verify token" }, { status: 403 });
    }

    if (req.method === "POST") {
      const body = await req.json();
      // Optionally persist raw event for debugging / replay
      await supabase.from("strava_events").insert({
        object_type: body?.object_type || null,
        aspect_type: body?.aspect_type || null,
        object_id: body?.object_id || null,
        owner_id: body?.owner_id || null,
        raw: body,
      });

      // You can fetch activity details here on 'create' events using the user's stored access_token
      // body: { object_type, object_id, owner_id, aspect_type, updates }

      return json({ received: true });
    }

    return json({ error: "Unsupported method" }, { status: 405 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, { status: 500 });
  }
});


