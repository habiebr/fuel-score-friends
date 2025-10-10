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
  '8', // Running
  '57', // Running on sand
  '58', // Running on stairs
  '59', // Running on treadmill
  '72', // Trail running
  '173', // Running (general)
  '174', // Running on treadmill (alternate)
  '175', // Running outdoors
  '176', // Running - high intensity
  '177', // Running - sprint
  '178', // Running - intervals
  '179', // Running - long distance
  '180', // Running - recovery
  '181', // Running - tempo
  '182', // Running - track
  '183', // Running - cross country
  '184', // Running - hill
  '185', // Running - race
  '186', // Running - warmup
  '187', // Running - cooldown
  '188', // Running - fartlek
  '3000', // Custom running activity
  '3001'
]);

function isRunningSession(session: any): boolean {
  const candidates = [
    session?.activity_type,
    session?.activityType,
    session?.activity,
    session?.activityTypeId,
    session?.name,
    session?.description,
    session?.raw?.activity_type,
    session?.raw?.activityType,
    session?.raw?.activity,
    session?.raw?.activityTypeId,
    session?.raw?.name,
    session?.raw?.description
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

function extractSessionDistanceMeters(session: any): number {
  const candidates = [
    session?._computed_distance_meters,
    session?.distance_meters,
    session?.distanceMeters,
    session?.raw?._computed_distance_meters,
    session?.raw?.distance_meters,
    session?.raw?.distanceMeters,
    session?.raw?.metrics?.distance,
    session?.raw?.metrics?.distance_meters
  ];

  const numeric = candidates
    .map(value => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    })
    .filter(value => value > 0);

  if (numeric.length === 0) return 0;
  return Math.max(...numeric);
}

function getSessionIdentifier(session: any): string | null {
  const id =
    session?.session_id ??
    session?.id ??
    session?.raw?.session_id ??
    session?.raw?.id;
  if (id) return String(id);

  const start =
    session?.start_time ??
    session?.startTimeMillis ??
    session?.raw?.start_time ??
    session?.raw?.startTimeMillis;
  const end =
    session?.end_time ??
    session?.endTimeMillis ??
    session?.raw?.end_time ??
    session?.raw?.endTimeMillis;

  if (start && end) {
    return `${start}-${end}`;
  }

  return null;
}

function getWeekStartStr(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start (1)
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, dateISO } = await req.json().catch(() => ({ userId: null, dateISO: null }));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Determine week window
    const baseDate = dateISO ? new Date(dateISO) : new Date();
    const weekStartStr = getWeekStartStr(baseDate);
    const weekStart = new Date(weekStartStr);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0,10);

    // fetch user list: derive from google_fit_data having session-linked rows in week window
    let users: Array<{ user_id: string }> = [];
    if (userId) {
      users = [{ user_id: userId }];
    } else {
      const seen = new Set<string>();
      const { data: gfUsers } = await sb
        .from('google_fit_data')
        .select('user_id')
        .gte('date', weekStartStr)
        .lte('date', weekEndStr);
      for (const r of gfUsers || []) {
        if (r.user_id && !seen.has(r.user_id)) {
          seen.add(r.user_id);
          users.push({ user_id: r.user_id });
        }
      }
      if (users.length === 0) {
        // Fallback: derive users from sessions table in the same window
        const { data: sessUsers } = await sb
          .from('google_fit_sessions')
          .select('user_id, start_time')
          .gte('start_time', `${weekStartStr}T00:00:00`)
          .lte('start_time', `${weekEndStr}T23:59:59`);
        for (const r of sessUsers || []) {
          if (r.user_id && !seen.has(r.user_id)) {
            seen.add(r.user_id);
            users.push({ user_id: r.user_id });
          }
        }
      }
    }

    let updated = 0;
    for (const u of users) {
      const { data: rows, error } = await sb
        .from('google_fit_data')
        .select('distance_meters, calories_burned, sessions')
        .eq('user_id', u.user_id)
        .gte('date', weekStartStr)
        .lte('date', weekEndStr);
      if (error) continue;
      const runningSessions = new Map<string, number>();
      let runningCalories = 0;

      const activityRows = rows || [];
      for (const row of activityRows) {
        const sessions = Array.isArray(row.sessions) ? row.sessions : [];
        let hasRunningSession = false;
        for (const session of sessions) {
          if (!isRunningSession(session)) continue;
          const sessionId = getSessionIdentifier(session);
          if (!sessionId) continue;
          const distance = extractSessionDistanceMeters(session);
          if (distance <= 0) continue;
          const existing = runningSessions.get(sessionId);
          if (!existing || distance > existing) {
            runningSessions.set(sessionId, distance);
          }
          hasRunningSession = true;
        }
        if (hasRunningSession) {
          runningCalories += Number(row.calories_burned) || 0;
        }
      }

      // Supplement with normalized sessions table in case session metadata was not embedded
      const { data: sessionRows } = await sb
        .from('google_fit_sessions')
        .select('session_id, activity_type, name, description, raw, start_time, end_time')
        .eq('user_id', u.user_id)
        .gte('start_time', `${weekStartStr}T00:00:00`)
        .lte('start_time', `${weekEndStr}T23:59:59`);

      for (const session of sessionRows || []) {
        if (!isRunningSession(session)) continue;
        const sessionId = getSessionIdentifier(session);
        if (!sessionId) continue;
        const distance = extractSessionDistanceMeters(session);
        if (distance <= 0) continue;
        const existing = runningSessions.get(sessionId);
        if (!existing || distance > existing) {
          runningSessions.set(sessionId, distance);
        }
      }

      const distanceM = Array.from(runningSessions.values()).reduce((sum, meters) => sum + meters, 0);
      const sessionCount = runningSessions.size;
      const calories = runningCalories;

      const { error: upErr } = await sb
        .from('weekly_activity_metrics')
        .upsert({
          user_id: u.user_id,
          week_start_date: weekStartStr,
          session_distance_m: distanceM,
          session_calories: calories,
          session_count: sessionCount,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,week_start_date' });
      if (!upErr) updated++;
    }

    return new Response(JSON.stringify({ success: true, updated, week_start: weekStartStr }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
