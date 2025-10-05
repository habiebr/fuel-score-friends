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

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "start";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID") ?? "";
    const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";
    const STRAVA_REDIRECT_URI = Deno.env.get("STRAVA_REDIRECT_URI") ?? ""; // e.g., https://<project>.functions.supabase.co/strava-auth?action=callback

    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REDIRECT_URI) {
      return json({ error: "Strava env not configured" }, { status: 500 });
    }

    if (action === "start") {
      // Expect Authorization: Bearer <user_jwt> to know user after callback
      const state = crypto.randomUUID();
      // State could be stored if you want to validate later
      const scope = "read,activity:read_all";
      const authorizeUrl = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(STRAVA_CLIENT_ID)}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=auto&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
      return json({ authorizeUrl });
    }

    if (action === "callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (error) return json({ error }, { status: 400 });
      if (!code) return json({ error: "Missing code" }, { status: 400 });

      // Optional: the frontend can pass the user token in Authorization header for identifying user
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing user token" }, { status: 401 });
      const userToken = authHeader.replace("Bearer ", "");

      // Decode JWT payload to get user id (sub)
      let userId: string | null = null;
      try {
        const payload = JSON.parse(atob(userToken.split(".")[1] || ""));
        userId = payload?.sub || null;
      } catch (_) {}
      if (!userId) return json({ error: "Invalid user token" }, { status: 401 });

      const tokenResp = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResp.ok) {
        const t = await tokenResp.text();
        return json({ error: "Token exchange failed", details: t }, { status: 400 });
      }
      const tokenJson = await tokenResp.json();
      const accessToken = tokenJson.access_token as string;
      const refreshToken = tokenJson.refresh_token as string;
      const expiresAtSec = tokenJson.expires_at as number | undefined;
      const scope = tokenJson.scope as string | undefined;

      const expiresAt = expiresAtSec ? new Date(expiresAtSec * 1000).toISOString() : null;

      const { error: upsertError } = await supabase.from("provider_connections").upsert(
        {
          user_id: userId,
          provider: "strava",
          access_token: accessToken,
          refresh_token: refreshToken,
          scope: scope || null,
          expires_at: expiresAt,
        },
        { onConflict: "user_id,provider" }
      );

      if (upsertError) return json({ error: upsertError.message }, { status: 500 });
      return json({ success: true });
    }

    return json({ error: "Unsupported action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, { status: 500 });
  }
});


