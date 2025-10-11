import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { isRunningSession, extractDistanceMeters, getSessionKey } from '../_shared/google-fit-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, expires, pragma',
};

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
          const sessionId = getSessionKey(session);
          if (!sessionId) continue;
          const distance = extractDistanceMeters(session);
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
        const sessionId = getSessionKey(session);
        if (!sessionId) continue;
        const distance = extractDistanceMeters(session);
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
