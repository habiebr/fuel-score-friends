/**
 * Quick Food Log Check - Distribution by Day
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const DEMO_USER_ID = 'cac8468f-6d30-4d6e-8dcc-382253748c55';

console.log('📊 FOOD LOG DISTRIBUTION CHECK\n');
console.log('='.repeat(80));

// Get food logs
const { data: logs } = await supabase
  .from('food_logs')
  .select('logged_at, calories, meal_type, food_name')
  .eq('user_id', DEMO_USER_ID)
  .order('logged_at', { ascending: false });

if (!logs) {
  console.log('❌ No food logs found');
  process.exit(1);
}

// Group by date
const byDate = {};
logs.forEach(log => {
  const date = log.logged_at.split('T')[0];
  if (!byDate[date]) {
    byDate[date] = { meals: 0, calories: 0, items: [] };
  }
  byDate[date].meals += 1;
  byDate[date].calories += log.calories || 0;
  byDate[date].items.push(`${log.food_name} (${log.calories} kcal)`);
});

// Display results
const dates = Object.keys(byDate).sort().reverse();
console.log(`\n📅 Found ${dates.length} days with food logs:\n`);

dates.forEach((date, index) => {
  const data = byDate[date];
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Australia/Melbourne' });
  const dayLabel = index === 0 ? 'TODAY' : index === 1 ? 'YESTERDAY' : `Day -${index}`;
  
  console.log(`${dayLabel.padEnd(12)} ${dayOfWeek} ${date}`);
  console.log(`  Meals:    ${data.meals}`);
  console.log(`  Calories: ${Math.round(data.calories)} kcal`);
  console.log('');
});

// Summary
const totalMeals = logs.length;
const totalCalories = logs.reduce((sum, log) => sum + (log.calories || 0), 0);
const avgCalories = Math.round(totalCalories / dates.length);

console.log('='.repeat(80));
console.log('\n📊 SUMMARY:\n');
console.log(`Total days:     ${dates.length} days`);
console.log(`Total meals:    ${totalMeals} logged`);
console.log(`Total calories: ${Math.round(totalCalories).toLocaleString()} kcal`);
console.log(`Average/day:    ${avgCalories.toLocaleString()} kcal`);

if (dates.length === 7) {
  console.log('\n✅ Perfect! Food logs are distributed across 7 days!');
} else {
  console.log(`\n⚠️  Warning: Expected 7 days, found ${dates.length} days`);
}

console.log('\n' + '='.repeat(80));
