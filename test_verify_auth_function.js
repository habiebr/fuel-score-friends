import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const ADMIN_KEY = process.env.ADMIN_FORCE_SYNC_KEY

// Validate required environment variables
if (!SUPABASE_URL) {
    console.error('Error: SUPABASE_URL is required. Set it as VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
    process.exit(1)
}
if (!ADMIN_KEY) {
    console.warn('Warning: ADMIN_FORCE_SYNC_KEY is not set. Admin tests will fail.')
}

console.log('Using Supabase URL:', SUPABASE_URL)

async function testVerifyAuth() {
  try {
    // Test 1: Request with missing auth
    console.log('\n1. Testing missing auth')
    const missingAuthResponse = await fetch(`${SUPABASE_URL}/functions/v1/verify-auth`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const missingAuthData = await missingAuthResponse.json()
    console.log('Status:', missingAuthResponse.status)
    console.log('Response:', missingAuthData)

    // Test 2: Request with invalid auth
    console.log('\n2. Testing invalid auth')
    const invalidAuthResponse = await fetch(`${SUPABASE_URL}/functions/v1/verify-auth`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid_token',
        'Content-Type': 'application/json'
      }
    })
    const invalidAuthData = await invalidAuthResponse.json()
    console.log('Status:', invalidAuthResponse.status)
    console.log('Response:', invalidAuthData)

    // Test 3: Request with admin key
    console.log('\n3. Testing admin key')
    const adminKeyResponse = await fetch(`${SUPABASE_URL}/functions/v1/verify-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy_token'
      },
      body: JSON.stringify({ admin_key: ADMIN_KEY })
    })
    const adminKeyData = await adminKeyResponse.json()
    console.log('Status:', adminKeyResponse.status)
    console.log('Response:', adminKeyData)

    // Test 4: Request with invalid admin key
    console.log('\n4. Testing invalid admin key')
    const invalidKeyResponse = await fetch(`${SUPABASE_URL}/functions/v1/verify-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy_token'
      },
      body: JSON.stringify({ admin_key: 'invalid_key' })
    })
    const invalidKeyData = await invalidKeyResponse.json()
    console.log('Status:', invalidKeyResponse.status)
    console.log('Response:', invalidKeyData)

  } catch (error) {
    console.error('Test error:', error)
  }
}

console.log('Starting verify-auth function tests...')
testVerifyAuth()