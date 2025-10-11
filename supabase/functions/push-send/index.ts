import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebPushPayload {
  title: string;
  body?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    if (!url || !serviceRole || !vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Missing server configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(url, serviceRole);

    // Auth check
    const { data: authUser } = await supabase.auth.getUser();
    const body = await req.json();
    const userId: string | undefined = authUser?.user?.id || body?.user_id;
    const payload: WebPushPayload = body?.payload || { title: "NutriSync" };
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch subscriptions for this user
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (error) throw error;

    // Send notifications via Web Push protocol (native fetch)
    const results: any[] = [];
    for (const sub of subs || []) {
      try {
        const jwt = await createVapidJWT(new URL(sub.endpoint).origin, vapidPublicKey, vapidPrivateKey);
        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            TTL: '2419200',
            Authorization: `WebPush ${jwt}`,
            'Content-Encoding': 'aes128gcm',
          },
          body: JSON.stringify(payload),
        });
        results.push({ endpoint: sub.endpoint, status: res.status });
      } catch (e) {
        results.push({ endpoint: sub.endpoint, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Minimal VAPID JWT creation using Web Crypto API (ES256)
async function createVapidJWT(audience: string, publicKey: string, privateKey: string) {
  const header = { alg: 'ES256', typ: 'JWT' };
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12h
  const claims = { aud: audience, exp: expiration, sub: 'mailto:admin@example.com' };
  const enc = (obj: any) => base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));

  const toSign = `${enc(header)}.${enc(claims)}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(toSign));
  const jwt = `${toSign}.${base64urlEncode(new Uint8Array(signature))}`;
  return jwt;
}

function base64urlEncode(data: Uint8Array) {
  let str = btoa(String.fromCharCode(...data));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function importPrivateKey(base64Url: string) {
  // Convert URL-safe base64 to raw
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=');
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const keyData = new Uint8Array([...raw].map(c => c.charCodeAt(0)));
  // Assume PKCS8 DER
  return await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}



