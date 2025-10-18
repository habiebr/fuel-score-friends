import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5NzAwNjQwMCwiZXhwIjoyMDEyNTgyNDAwfQ.WpB5Kg0RkYh9raXRH3qVHg2J2c1r3O9d1LtUCvF31h0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBucket() {
  try {
    console.log('🔍 Checking food-photos bucket...\n');
    
    // List files in food-photos bucket
    const { data, error } = await supabase.storage
      .from('food-photos')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`✅ Found ${data?.length || 0} files in food-photos bucket:\n`);
    
    if (!data || data.length === 0) {
      console.log('📦 Bucket is empty!');
      return;
    }

    // Group by user
    const byUser = {};
    data.forEach(file => {
      const userPath = file.name.split('/')[0];
      if (!byUser[userPath]) byUser[userPath] = [];
      byUser[userPath].push(file);
    });

    for (const [user, files] of Object.entries(byUser)) {
      console.log(`👤 User: ${user}`);
      files.slice(0, 10).forEach(file => {
        const date = new Date(file.created_at).toLocaleDateString();
        const size = file.metadata?.size ? (file.metadata.size / 1024).toFixed(1) : 'N/A';
        console.log(`   📄 ${file.name} (${size}KB) - ${date}`);
      });
      if (files.length > 10) {
        console.log(`   ... and ${files.length - 10} more files`);
      }
      console.log();
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkBucket();
