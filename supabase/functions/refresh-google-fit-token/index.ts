// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { refreshToken } = await req.json().catch(() => ({}));
    if (!refreshToken) {
      console.error("No refresh token provided");
      return new Response(JSON.stringify({ error: "refreshToken is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = getEnv("GOOGLE_CLIENT_ID");
    const clientSecret = getEnv("GOOGLE_CLIENT_SECRET", false);

    if (!clientId) {
      console.error("GOOGLE_CLIENT_ID not configured");
      return new Response(JSON.stringify({ error: "Google client ID not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Refreshing Google Fit token...");
    const body = new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    if (clientSecret) {
      body.append("client_secret", clientSecret);
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMessage = data?.error_description || data?.error || "Failed to refresh token";
      console.error("Google token refresh failed:", errorMessage, data);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Google Fit token refreshed successfully");
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in refresh-google-fit-token function:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

