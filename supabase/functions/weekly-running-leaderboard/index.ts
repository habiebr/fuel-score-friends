import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUN_KEYWORDS = [
  'run',
  'jog',
  'marathon',
  'trail',
  'treadmill',
  'road run',
  'half',
  '5k',
  '10k'
];

const RUN_ACTIVITY_CODES = new Set([
  '8', '57', '58', '59', '72',
  '173', '174', '175', '176', '177', '178', '179', '180', '181', '182', '183', '184', '185', '186', '187', '188',
  '3000', '3001'
]);

function normalizeWeekStart(date: Date): Date {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date supplied to weekly-running-leaderboard');
  }
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isRunningSession(session: Record<string, unknown> | null | undefined): boolean {
  if (!session) return false;
  const candidates = [
    session?.activity_type,
    session?.activityType,
    session?.activity,
    session?.activityTypeId,
    session?.name,
    session?.description,
    (session as any)?.raw?.activity_type,
    (session as any)?.raw?.activityType,
    (session as any)?.raw?.activity,
    (session as any)?.raw?.activityTypeId,
    (session as any)?.raw?.name,
    (session as any)?.raw?.description,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const text = String(candidate).toLowerCase();
    if (RUN_KEYWORDS.some(keyword => text.includes(keyword))) {
      return true;
    }
    if (RUN_ACTIVITY_CODES.has(text)) {
      return true;
    }
    const numeric = Number(candidate);
    if (!Number.isNaN(numeric) && RUN_ACTIVITY_CODES.has(String(numeric))) {
      return true;
    }
  }
  return false;
}

function extractDistanceMeters(session: Record<string, unknown> | null | undefined): number {
  if (!session) return 0;
  const candidates = [
    (session as any)?._computed_distance_meters,
    (session as any)?.distance_meters,
    (session as any)?.distanceMeters,
    (session as any)?.raw?._computed_distance_meters,
    (session as any)?.raw?.distance_meters,
    (session as any)?.raw?.distanceMeters,
    (session as any)?.raw?.metrics?.distance,
    (session as any)?.raw?.metrics?.distance_meters,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function getSessionKey(session: Record<string, unknown> | null | undefined): string | null {
  if (!session) return null;
  const id =
    (session as any)?.session_id ??
    (session as any)?.id ??
    (session as any)?.raw?.session_id ??
    (session as any)?.raw?.id;
  if (id) return String(id);

  const start =
    (session as any)?.start_time ??
    (session as any)?.startTimeMillis ??
    (session as any)?.raw?.start_time ??
    (session as any)?.raw?.startTimeMillis;
  const end =
    (session as any)?.end_time ??
    (session as any)?.endTimeMillis ??
    (session as any)?.raw?.end_time ??
    (session as any)?.raw?.endTimeMillis;

  if (start && end) {
    return `${start}-${end}`;
  }

  return null;
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
