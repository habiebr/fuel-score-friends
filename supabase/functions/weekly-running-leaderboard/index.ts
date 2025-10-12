import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { isRunningSession, extractDistanceMeters, getSessionKey } from '../_shared/google-fit-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, expires, pragma',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Default to UTC+7 if no timezone offset provided
const DEFAULT_TIMEZONE_OFFSET_HOURS = 7;

function normalizeWeekStart(date: Date, timezoneOffset?: number): Date {
  // Use provided timezone offset or default to UTC+7
  const offsetHours = typeof timezoneOffset === 'number' ? timezoneOffset : DEFAULT_TIMEZONE_OFFSET_HOURS;
  // Convert to local time using offset
  const localTime = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000));
  
  if (Number.isNaN(localTime.getTime())) {
    throw new Error('Invalid date supplied to weekly-running-leaderboard');
  }
  
  // Get day of week in local time
  const day = localTime.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  
  // Set to Monday 00:00 local time
  localTime.setUTCDate(localTime.getUTCDate() + diff);
  localTime.setUTCHours(0, 0, 0, 0);
  
  // Convert back to UTC
  return new Date(localTime.getTime() - (offsetHours * 60 * 60 * 1000));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { weekStart, userId } = await req.json().catch(() => ({ weekStart: null, userId: null }));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    const baseDate = weekStart ? new Date(weekStart) : new Date();
    const start = normalizeWeekStart(baseDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const weekStartStr = start.toISOString().slice(0, 10);
    const weekEndStr = end.toISOString().slice(0, 10);

    const perUserSessions = new Map<string, Map<string, number>>();

    function ensureMap(uid: string) {
      if (!perUserSessions.has(uid)) {
        perUserSessions.set(uid, new Map());
      }
      return perUserSessions.get(uid)!;
    }

    function upsertSessionDistance(uid: string, key: string, distance: number) {
      const map = ensureMap(uid);
      const existing = map.get(key) ?? 0;
      if (distance > existing) {
        map.set(key, distance);
      }
    }

    function processSession(uid: string, session: Record<string, unknown> | null | undefined) {
      if (!uid || !session || !isRunningSession(session)) {
        return { isRunning: false, hasDistance: false, distance: 0 };
      }
      const distance = extractDistanceMeters(session);
      const key = getSessionKey(session) || `${(session as any)?.start_time ?? ''}-${(session as any)?.end_time ?? ''}`;
      if (distance > 0) {
        upsertSessionDistance(uid, key, distance);
        return { isRunning: true, hasDistance: true, distance };
      }
      // Track placeholder (0) so we know session existed
      upsertSessionDistance(uid, key, 0);
      return { isRunning: true, hasDistance: false, distance: 0 };
    }

    const dailyQuery = sb
      .from('google_fit_data')
      .select('user_id, date, sessions, distance_meters')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);
    if (userId) {
      dailyQuery.eq('user_id', userId);
    }
    const { data: dailyRows, error: dailyError } = await dailyQuery;

    if (dailyError) {
      console.error('weekly-running-leaderboard daily fetch error:', dailyError);
    }

    for (const row of dailyRows || []) {
      const userId = (row as any)?.user_id;
      if (!userId) continue;
      const sessions = Array.isArray((row as any)?.sessions) ? (row as any)?.sessions : [];
      let hasRunning = false;
      let positiveDistance = 0;
      for (const session of sessions) {
        const result = processSession(userId, session);
        if (!result.isRunning) continue;
        hasRunning = true;
        if (result.hasDistance) {
          positiveDistance += result.distance;
        }
      }
      if (hasRunning && positiveDistance === 0) {
        const fallbackDistance = Number((row as any)?.distance_meters) || 0;
        if (fallbackDistance > 0) {
          upsertSessionDistance(userId, `daily-${(row as any)?.date ?? ''}`, fallbackDistance);
        }
      }
    }

    const sessionQuery = sb
      .from('google_fit_sessions')
      .select('user_id, session_id, activity_type, name, description, raw, start_time, end_time')
      .gte('start_time', `${weekStartStr}T00:00:00`)
      .lte('start_time', `${weekEndStr}T23:59:59`);
    if (userId) {
      sessionQuery.eq('user_id', userId);
    }
    const { data: sessionRows, error: sessionError } = await sessionQuery;

    if (sessionError) {
      console.error('weekly-running-leaderboard sessions fetch error:', sessionError);
    }

    for (const row of sessionRows || []) {
      const userId = (row as any)?.user_id;
      if (!userId) continue;
      processSession(userId, row as Record<string, unknown>);
    }

    const entries = Array.from(perUserSessions.entries()).map(([userId, sessions]) => {
      const totalMeters = Array.from(sessions.values()).reduce((sum, meters) => sum + meters, 0);
      return {
        user_id: userId,
        distance_meters: totalMeters,
        session_count: sessions.size,
      };
    });

    return new Response(JSON.stringify({
      week_start: weekStartStr,
      week_end: weekEndStr,
      entries,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('weekly-running-leaderboard error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
