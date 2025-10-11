import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function testUpdateActualTraining() {
  try {
    // First get user token
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD
    })

    if (authError) {
      console.error('Auth error:', authError)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    
    // Make request with user's JWT
    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/update-actual-training`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.session.access_token}`
      },
      body: JSON.stringify({ date: today })
    })

    const data = await response.json()
    console.log('Response:', data)

  } catch (error) {
    console.error('Test failed:', error)
  }
}

console.log('Testing update-actual-training endpoint...')
testUpdateActualTraining()