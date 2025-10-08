import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-refresh-secret, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

const DEFAULT_THRESHOLD_MINUTES = 20;
const DEFAULT_BATCH_SIZE = 25;

interface TokenRecord {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  refresh_count: number;
  token_type?: string | null;
  scope?: string | null;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

interface RefreshSummary {
  user_id: string;
  token_id: string;
  refreshed: boolean;
  deactivated?: boolean;
  error?: string;
  expires_at_before?: string;
  expires_at_after?: string;
}

function buildErrorResponse(status: number, message: string, detail?: unknown) {
  const payload = {
    error: message,
    detail: detail instanceof Error ? detail.message : detail,
  };
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return buildErrorResponse(405, "Method not allowed");
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const secondarySecret = req.headers.get("x-refresh-secret") || req.headers.get("X-Refresh-Secret") || "";
  const cronSecret = Deno.env.get("GOOGLE_TOKEN_REFRESH_SECRET") || Deno.env.get("TOKEN_REFRESH_SECRET") || "";

  if (cronSecret) {
    const bearerMatch = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const secretMatches = bearerMatch === cronSecret || secondarySecret === cronSecret;
    if (!secretMatches) {
      return buildErrorResponse(401, "Unauthorized");
    }
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const {
    threshold_minutes: thresholdMinutes = DEFAULT_THRESHOLD_MINUTES,
    batch_size: batchSize = DEFAULT_BATCH_SIZE,
    force_refresh: forceRefresh = false,
    user_ids: userIds,
  } = body ?? {};

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return buildErrorResponse(500, "Supabase credentials not configured");
  }

  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") || Deno.env.get("VITE_GOOGLE_CLIENT_ID");
  if (!googleClientId) {
    return buildErrorResponse(500, "Google Client ID not configured");
  }
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || Deno.env.get("VITE_GOOGLE_CLIENT_SECRET");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        "X-Client-Info": "token-refresh-cron",
      },
    },
  });

  const now = new Date();
  const thresholdDate = new Date(now.getTime() + Number(thresholdMinutes) * 60 * 1000);

  let tokenQuery = supabase
    .from("google_tokens")
    .select("id,user_id,access_token,refresh_token,expires_at,refresh_count,token_type,scope")
    .eq("is_active", true)
    .order("expires_at", { ascending: true })
    .limit(Number(batchSize));

  if (!forceRefresh) {
    tokenQuery = tokenQuery.lte("expires_at", thresholdDate.toISOString());
  }

  if (Array.isArray(userIds) && userIds.length > 0) {
    tokenQuery = tokenQuery.in("user_id", userIds);
  }

  const { data: tokens, error: tokenError } = await tokenQuery;
  if (tokenError) {
    console.error("Failed to fetch Google tokens:", tokenError);
    return buildErrorResponse(500, "Failed to fetch Google tokens", tokenError);
  }

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      processed: 0,
      refreshed: 0,
      deactivated: 0,
      skipped: 0,
      threshold_minutes: thresholdMinutes,
      batch_size: batchSize,
      message: "No tokens required refreshing",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summaries: RefreshSummary[] = [];
  let refreshedCount = 0;
  let deactivatedCount = 0;
  let skippedCount = 0;

  for (const token of tokens as TokenRecord[]) {
    if (!token.refresh_token) {
      summaries.push({
        user_id: token.user_id,
        token_id: token.id,
        refreshed: false,
        error: "Missing refresh token",
      });
      skippedCount += 1;
      continue;
    }

    const expiresAt = new Date(token.expires_at);
    const needsRefresh = forceRefresh || expiresAt <= thresholdDate;

    if (!needsRefresh) {
      summaries.push({
        user_id: token.user_id,
        token_id: token.id,
        refreshed: false,
        expires_at_before: token.expires_at,
      });
      skippedCount += 1;
      continue;
    }

    try {
      const bodyParams = new URLSearchParams({
        client_id: googleClientId,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
      });
      if (googleClientSecret) {
        bodyParams.set("client_secret", googleClientSecret);
      }

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: bodyParams.toString(),
      });

      const responseText = await refreshResponse.text();
      if (!refreshResponse.ok) {
        let errorMessage = responseText;
        try {
          const parsed = JSON.parse(responseText);
          errorMessage = parsed.error_description || parsed.error || responseText;
        } catch {
          // keep raw text
        }

        console.error(`Failed to refresh token for user ${token.user_id}:`, errorMessage);

        const invalidGrant = errorMessage.includes("invalid_grant") || errorMessage.includes("invalid_token");
        if (invalidGrant) {
          const { error: deactivateError } = await supabase
            .from("google_tokens")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", token.id);
          if (deactivateError) {
            console.error("Failed to deactivate invalid token:", deactivateError);
          }
        }

        summaries.push({
          user_id: token.user_id,
          token_id: token.id,
          refreshed: false,
          deactivated: invalidGrant,
          error: errorMessage,
          expires_at_before: token.expires_at,
        });

        if (invalidGrant) {
          deactivatedCount += 1;
        } else {
          skippedCount += 1;
        }
        continue;
      }

      let tokenData: GoogleTokenResponse;
      try {
        tokenData = JSON.parse(responseText) as GoogleTokenResponse;
      } catch (parseError) {
        console.error("Failed to parse Google response:", parseError, responseText);
        summaries.push({
          user_id: token.user_id,
          token_id: token.id,
          refreshed: false,
          error: "Failed to parse Google token response",
        });
        skippedCount += 1;
        continue;
      }

      const newExpiresAt = new Date(now.getTime() + tokenData.expires_in * 1000).toISOString();

      const { error: updateError } = await supabase
        .from("google_tokens")
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || token.refresh_token,
          expires_at: newExpiresAt,
          token_type: tokenData.token_type || token.token_type || "Bearer",
          scope: tokenData.scope || token.scope || "https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read",
          last_refreshed_at: now.toISOString(),
          refresh_count: token.refresh_count + 1,
          updated_at: now.toISOString(),
        })
        .eq("id", token.id);

      if (updateError) {
        console.error("Failed to update refreshed token:", updateError);
        summaries.push({
          user_id: token.user_id,
          token_id: token.id,
          refreshed: false,
          error: "Failed to persist refreshed token",
          expires_at_before: token.expires_at,
          expires_at_after: newExpiresAt,
        });
        skippedCount += 1;
        continue;
      }

      refreshedCount += 1;
      summaries.push({
        user_id: token.user_id,
        token_id: token.id,
        refreshed: true,
        expires_at_before: token.expires_at,
        expires_at_after: newExpiresAt,
      });
    } catch (error) {
      console.error(`Unexpected error refreshing token for user ${token.user_id}:`, error);
      summaries.push({
        user_id: token.user_id,
        token_id: token.id,
        refreshed: false,
        error: error instanceof Error ? error.message : String(error),
      });
      skippedCount += 1;
    }

    // Minimal jitter between requests to avoid hammering Google's token endpoint
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return new Response(JSON.stringify({
    success: true,
    processed: tokens.length,
    refreshed: refreshedCount,
    skipped: skippedCount,
    deactivated: deactivatedCount,
    threshold_minutes: thresholdMinutes,
    batch_size: batchSize,
    force_refresh: forceRefresh,
    results: summaries,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
