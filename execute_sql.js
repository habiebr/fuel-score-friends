// Execute SQL directly using Supabase client
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co'
const supabaseKey = 'your_anon_key_here' // You'll need to replace this

const supabase = createClient(supabaseUrl, supabaseKey)

async function addMissingColumns() {
  try {
    // Add missing columns
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS target_date DATE,
        ADD COLUMN IF NOT EXISTS fitness_level TEXT;
      `
    })
    
    if (error) {
      console.error('Error:', error)
    } else {
      console.log('Success:', data)
    }
  } catch (err) {
    console.error('Exception:', err)
  }
}

addMissingColumns()
