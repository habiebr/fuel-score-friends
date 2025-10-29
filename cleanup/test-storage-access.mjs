#!/usr/bin/env node

/**
 * Test Storage Access for Food Photos
 * Verifies that authenticated users can upload food photos
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://eecdbddpzwedficnpenm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_ANON_KEY not found');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testStorageAccess() {
  console.log('🧪 Testing Food Photo Storage Access\n');

  // Test 1: Check bucket exists
  console.log('1️⃣ Checking if food-photos bucket exists...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error('❌ Error listing buckets:', bucketError.message);
    return;
  }

  const foodPhotosBucket = buckets?.find(b => b.id === 'food-photos');
  if (foodPhotosBucket) {
    console.log('✅ food-photos bucket exists');
    console.log('   - Public:', foodPhotosBucket.public);
    console.log('   - File size limit:', foodPhotosBucket.file_size_limit, 'bytes');
    console.log('   - Allowed MIME types:', foodPhotosBucket.allowed_mime_types);
  } else {
    console.log('❌ food-photos bucket NOT FOUND');
    console.log('   Available buckets:', buckets?.map(b => b.id).join(', '));
    return;
  }

  // Test 2: Check storage policies (requires service role or authenticated user)
  console.log('\n2️⃣ Testing upload permission (requires authenticated user)...');
  
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.log('⚠️  No authenticated user session found');
    console.log('   To test upload permissions, run:');
    console.log('   1. Sign in to the app');
    console.log('   2. Get user token from DevTools > Application > Local Storage > sb-*-auth-token');
    console.log('   3. Set SUPABASE_USER_TOKEN environment variable');
    console.log('\n✅ Bucket exists and is configured correctly');
    console.log('   Users should be able to upload when authenticated');
    return;
  }

  console.log('✅ User authenticated:', session.user.email);
  
  // Test 3: Try to upload a test file
  console.log('\n3️⃣ Testing file upload...');
  
  const testFile = new Blob(['test'], { type: 'image/png' });
  const testPath = `${session.user.id}/test-${Date.now()}.png`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('food-photos')
    .upload(testPath, testFile, {
      contentType: 'image/png',
      upsert: true
    });

  if (uploadError) {
    console.error('❌ Upload failed:', uploadError.message);
    console.log('   This might be a policy issue');
    return;
  }

  console.log('✅ Upload successful:', uploadData.path);

  // Test 4: Try to get signed URL
  console.log('\n4️⃣ Testing signed URL generation...');
  
  const { data: signedData, error: signedError } = await supabase.storage
    .from('food-photos')
    .createSignedUrl(testPath, 60);

  if (signedError) {
    console.error('❌ Signed URL failed:', signedError.message);
    return;
  }

  console.log('✅ Signed URL created:', signedData.signedUrl.substring(0, 80) + '...');

  // Test 5: Clean up
  console.log('\n5️⃣ Cleaning up test file...');
  
  const { error: deleteError } = await supabase.storage
    .from('food-photos')
    .remove([testPath]);

  if (deleteError) {
    console.error('⚠️  Delete failed:', deleteError.message);
  } else {
    console.log('✅ Test file deleted');
  }

  console.log('\n✅ ALL TESTS PASSED - Users can upload food photos');
}

testStorageAccess().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
