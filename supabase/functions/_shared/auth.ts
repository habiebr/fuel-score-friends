import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

interface AuthResponse {
  isAuthorized: boolean
  isAdmin: boolean
  user: any
  client: any
}

const SUPABASE_URL = 'https://eecdbddpzwedficnpenm.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5NjE4NzYxNCwiZXhwIjoyMDExNzYzNjE0fQ.l_YcDwjh0e1HyUNhw4kcQCuBHZKqmNpWGW6AZ8khSEs'

export async function handleAuth(req: Request): Promise<AuthResponse | Response> {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const jwt = authHeader.split(' ')[1]
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // First try to get user info with the JWT
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
    
    if (userError || !userData?.user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid JWT token', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return {
      isAuthorized: true,
      isAdmin: userData.user.app_metadata?.roles?.includes('admin') || false,
      user: userData.user,
      client: supabase
    }

  } catch (error) {
    console.error('Auth error:', error)
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}