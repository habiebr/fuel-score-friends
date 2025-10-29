#!/usr/bin/env node

/**
 * Apply storage bucket configuration to production database
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eecdbddpzwedficnpenm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  console.log('\nPlease set the service role key:');
  console.log('export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.log('\nYou can find it in Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyStorageBuckets() {
  console.log('🚀 Applying storage bucket configuration...\n');

  const sql = fs.readFileSync('./apply-storage-buckets.sql', 'utf8');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try direct approach using REST API
      console.log('⚠️  RPC approach failed, trying direct SQL execution...\n');
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log('✅ Storage buckets created successfully via REST API\n');
    } else {
      console.log('✅ Storage buckets created successfully\n');
    }

    // Verify buckets were created
    console.log('🔍 Verifying bucket creation...\n');
    
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      throw bucketsError;
    }

    const foodPhotos = buckets.find(b => b.id === 'food-photos');
    const fitnessScreenshots = buckets.find(b => b.id === 'fitness-screenshots');

    console.log('📦 Available buckets:');
    console.log(`   - food-photos: ${foodPhotos ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - fitness-screenshots: ${fitnessScreenshots ? '✅ EXISTS' : '❌ MISSING'}`);

    if (foodPhotos && fitnessScreenshots) {
      console.log('\n✅ SUCCESS! All storage buckets are configured correctly.');
      console.log('   Users can now upload food photos and fitness screenshots.');
    } else {
      console.log('\n⚠️  Some buckets may not have been created. Please check manually.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n🔧 Manual fix required:');
    console.log('1. Go to Supabase Dashboard > Storage');
    console.log('2. Create bucket "food-photos" with:');
    console.log('   - Public: false');
    console.log('   - File size limit: 10MB');
    console.log('   - Allowed MIME types: image/jpeg, image/png, image/webp, image/gif, image/heic');
    console.log('3. Create bucket "fitness-screenshots" with same settings');
    console.log('4. Add RLS policies from apply-storage-buckets.sql');
    process.exit(1);
  }
}

applyStorageBuckets();
