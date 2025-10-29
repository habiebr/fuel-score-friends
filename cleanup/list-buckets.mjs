#!/usr/bin/env node

/**
 * List all storage buckets
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://eecdbddpzwedficnpenm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_ANON_KEY not found');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listBuckets() {
  console.log('📦 Listing all storage buckets...\n');

  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!buckets || buckets.length === 0) {
    console.log('⚠️  No buckets found');
    return;
  }

  console.log(`Found ${buckets.length} bucket(s):\n`);
  
  buckets.forEach((bucket, i) => {
    console.log(`${i + 1}. ${bucket.id}`);
    console.log(`   - Name: ${bucket.name}`);
    console.log(`   - Public: ${bucket.public}`);
    console.log(`   - File size limit: ${bucket.file_size_limit || 'unlimited'}`);
    console.log(`   - Allowed MIME types: ${bucket.allowed_mime_types || 'any'}`);
    console.log(`   - Created: ${bucket.created_at}`);
    console.log('');
  });
}

listBuckets().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
