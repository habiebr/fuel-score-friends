// Centralized env access for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export function getEnv(name: string, required = true): string {
  const v = Deno.env.get(name) ?? "";
  if (required && !v) {
    console.error(`Missing required env: ${name}`);
  }
  return v;
}

export function getSupabaseUrl() {
  return getEnv("SUPABASE_URL");
}

export function getServiceRoleKey() {
  return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getAnonKey() {
  return getEnv("SUPABASE_ANON_KEY", false);
}

export function getGroqKey() {
  return getEnv("GROQ_API_KEY", false);
}

export function getSupabaseAdmin() {
  return createClient(getSupabaseUrl(), getServiceRoleKey());
}


