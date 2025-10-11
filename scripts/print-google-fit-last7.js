import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const SUPABASE_URL = args[0] || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = args[1] || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const DAYS = parseInt(args[2] || '7', 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase config');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (DAYS - 1));
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

  // Users with active google fit
  const { data: tokens, error: tErr } = await supabase
    .from('google_tokens')
    .select('user_id')
    .eq('is_active', true);
  if (tErr) throw tErr;
  const userIds = Array.from(new Set((tokens || []).map(t => t.user_id)));

  const result = {};
  for (const uid of userIds) {
    const { data, error } = await supabase
      .from('google_fit_data')
      .select('date, steps, calories_burned, active_minutes, distance_meters, heart_rate_avg')
      .eq('user_id', uid)
      .gte('date', startISO)
      .lte('date', endISO)
      .order('date', { ascending: true });
    if (error) {
      result[uid] = { error: error.message };
      continue;
    }
    result[uid] = data || [];
  }

  console.log(JSON.stringify({ range: { start: startISO, end: endISO }, users: result }, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); });

