import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const lines = envContent.split('\n');

const urlMatch = lines.find(l => l.startsWith('VITE_SUPABASE_URL='));
const keyMatch = lines.find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='));

if (urlMatch) {
  const url = urlMatch.split('=')[1];
  const projectId = url.split('https://')[1]?.split('.')[0];
  console.log('Current Supabase Project ID:', projectId);
  console.log('Full URL:', url);
}

if (keyMatch) {
  const key = keyMatch.split('=')[1];
  console.log('Anon Key (first 30 chars):', key.substring(0, 30) + '...');
}

// Now check what URL the deployed beta app is using
console.log('\n📍 Beta app URL: https://cf996e73.nutrisync-beta.pages.dev');
console.log('This will show us what project it\'s actually connected to when we load it...');
