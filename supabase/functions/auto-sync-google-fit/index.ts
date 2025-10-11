import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleFitDatapoint {
  startTimeMillis: string
  endTimeMillis: string
  value: Array<{ fpVal?: number; intVal?: number }>
}

interface GoogleFitDataset {
  point: GoogleFitDatapoint[]
}

interface GoogleFitBucket {
  dataset: GoogleFitDataset[]
  startTimeMillis: string
  endTimeMillis: string
}

/**
 * Background auto-sync edge function that runs every 5 minutes via cron
 * Syncs Google Fit data for all active users with valid tokens
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify this is a cron job or admin request
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    
    // Allow requests with valid service role key or cron secret
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const isValidCron = cronSecret && authHeader === `Bearer ${cronSecret}`
    const isValidServiceRole = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`
    
    if (!isValidCron && !isValidServiceRole) {
      console.warn('Unauthorized auto-sync attempt')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role (for admin operations)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔄 Starting auto-sync for all active Google Fit users...')

    // Get all users with valid Google tokens
    const { data: users, error: usersError } = await supabase
      .from('google_tokens')
      .select('user_id, access_token, refresh_token, expires_at')
      .eq('is_active', true)

    if (usersError) {
      console.error('Error fetching users:', usersError)
      throw usersError
    }

    if (!users || users.length === 0) {
      console.log('No users with Google Fit tokens found')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users to sync',
          synced: 0,
          skipped: 0,
          errors: 0
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${users.length} users with Google Fit tokens`)

    let syncedCount = 0
    let errorCount = 0
    let skippedCount = 0

    // Sync each user's Google Fit data
    for (const user of users) {
      try {
        // Check if user needs sync (last sync > 5 minutes ago)
        const { data: lastSyncData } = await supabase
          .from('google_fit_data')
          .select('last_synced_at')
          .eq('user_id', user.user_id)
          .order('last_synced_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const lastSyncTime = lastSyncData?.last_synced_at ? new Date(lastSyncData.last_synced_at).getTime() : 0
        const now = Date.now()
        const timeSinceLastSync = now - lastSyncTime

        // Skip if synced within last 5 minutes
        if (timeSinceLastSync < 5 * 60 * 1000) {
          console.log(`Skipping user ${user.user_id.substring(0, 8)}... (synced ${Math.round(timeSinceLastSync / 1000)}s ago)`)
          skippedCount++
          continue
        }

        // Check if token is expired
        let accessToken = user.access_token
        const expiresAt = user.expires_at ? new Date(user.expires_at).getTime() : 0
        
        // If token is expired or about to expire in next 5 minutes, refresh it
        if (expiresAt < now + 5 * 60 * 1000) {
          console.log(`Refreshing expired token for user ${user.user_id.substring(0, 8)}...`)
          
          const refreshToken = user.refresh_token
          if (!refreshToken) {
            console.error(`User ${user.user_id.substring(0, 8)}... has no refresh token`)
            errorCount++
            continue
          }

          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
              client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }),
          })

          if (!tokenResponse.ok) {
            console.error(`Failed to refresh token for user ${user.user_id.substring(0, 8)}...`)
            errorCount++
            continue
          }

          const tokenData = await tokenResponse.json()
          accessToken = tokenData.access_token
          
          // Update the token in database
          const newExpiresAt = new Date(now + tokenData.expires_in * 1000).toISOString()
          await supabase
            .from('google_tokens')
            .update({
              access_token: accessToken,
              expires_at: newExpiresAt,
            })
            .eq('user_id', user.user_id)
        }

        // Fetch today's Google Fit data
        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

        const startTimeMillis = startOfDay.getTime()
        const endTimeMillis = endOfDay.getTime()

        // Fetch steps, calories, distance, and active minutes
        const aggregateResponse = await fetch(
          `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              aggregateBy: [
                { dataTypeName: 'com.google.step_count.delta' },
                { dataTypeName: 'com.google.calories.expended' },
                { dataTypeName: 'com.google.distance.delta' },
                { dataTypeName: 'com.google.active_minutes' },
              ],
              bucketByTime: { durationMillis: endTimeMillis - startTimeMillis },
              startTimeMillis,
              endTimeMillis,
            }),
          }
        )

        if (!aggregateResponse.ok) {
          console.error(`Google Fit API error for user ${user.user_id.substring(0, 8)}...: ${aggregateResponse.status}`)
          errorCount++
          continue
        }

        const aggregateData = await aggregateResponse.json()
        const buckets: GoogleFitBucket[] = aggregateData.bucket || []

        let steps = 0
        let caloriesBurned = 0
        let distanceMeters = 0
        let activeMinutes = 0

        buckets.forEach((bucket) => {
          bucket.dataset.forEach((dataset, index) => {
            dataset.point.forEach((point) => {
              const value = point.value[0]?.intVal || point.value[0]?.fpVal || 0
              
              if (index === 0) steps += value
              else if (index === 1) caloriesBurned += value
              else if (index === 2) distanceMeters += value
              else if (index === 3) activeMinutes += value
            })
          })
        })

        // Store in database
        const dateStr = startOfDay.toISOString().split('T')[0]
        const { error: upsertError } = await supabase
          .from('google_fit_data')
          .upsert({
            user_id: user.user_id,
            date: dateStr,
            steps,
            calories_burned: caloriesBurned,
            distance_meters: distanceMeters,
            active_minutes: activeMinutes,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,date',
          })

        if (upsertError) {
          console.error(`Error storing data for user ${user.user_id.substring(0, 8)}...:`, upsertError)
          errorCount++
          continue
        }

        console.log(`✅ Synced user ${user.user_id.substring(0, 8)}...: ${steps} steps, ${Math.round(caloriesBurned)} cal`)
        syncedCount++

      } catch (userError) {
        console.error(`Error syncing user ${user.user_id}:`, userError)
        errorCount++
      }
    }

    console.log(`🎯 Auto-sync complete: ${syncedCount} synced, ${skippedCount} skipped, ${errorCount} errors`)

    return new Response(
      JSON.stringify({ 
        success: true,
        synced: syncedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: users.length,
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Auto-sync error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
