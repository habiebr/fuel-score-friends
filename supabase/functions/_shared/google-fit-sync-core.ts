/**
 * Google Fit Sync Core Module
 * 
 * Shared sync logic used by:
 * - fetch-google-fit-data (real-time sync for single user, today)
 * - sync-historical-google-fit-data (backfill historical data)
 * - sync-all-users-direct (batch sync all users)
 * 
 * Consolidates ~200 lines of duplicate API calling and data transformation logic
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  exerciseActivities,
  excludedActivities,
  includedActivityCodes,
  excludedActivityCodes
} from './google-fit-activities.ts';
import { normalizeActivityName } from './google-fit-utils.ts';

export interface GoogleFitDayData {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distanceMeters: number;
  heartRateAvg?: number;
  sessions: any[];
}

export interface SyncOptions {
  useCache?: boolean;
  cacheExpiryMinutes?: number;
}

/**
 * Fetch aggregate data from Google Fit API
 */
async function fetchAggregate(
  accessToken: string,
  dataTypeName: string,
  startTimeMillis: number,
  endTimeMillis: number
): Promise<any> {
  const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      aggregateBy: [{ dataTypeName }],
      bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
      startTimeMillis,
      endTimeMillis
    })
  });

  if (res.status === 401) {
    throw new Error('Google Fit token expired');
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Fit API error for ${dataTypeName}: ${res.status} - ${errorText}`);
  }

  return await res.json();
}

/**
 * Fetch sessions from Google Fit API
 */
async function fetchSessions(
  accessToken: string,
  startTime: Date,
  endTime: Date
): Promise<any[]> {
  const res = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (res.status === 401) {
    throw new Error('Google Fit token expired');
  }

  if (!res.ok) {
    console.warn(`Failed to fetch sessions: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.session || [];
}

/**
 * Fetch distance data for a specific session
 */
async function fetchSessionDistance(
  accessToken: string,
  session: any
): Promise<number> {
  const startTimeMillis = parseInt(session.startTimeMillis);
  const endTimeMillis = parseInt(session.endTimeMillis);

  try {
    const res = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.distance.delta' }],
          bucketByTime: { durationMillis: endTimeMillis - startTimeMillis },
          startTimeMillis,
          endTimeMillis
        })
      }
    );

    if (res.ok) {
      const data = await res.json();
      const distance = data.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
      return distance;
    }
  } catch (error) {
    console.warn(`Failed to fetch distance for session ${session.id}:`, error);
  }

  return 0;
}

/**
 * Filter sessions to only include valid exercise activities
 */
export function filterExerciseSessions(sessions: any[]): any[] {
  return sessions.filter((session: any) => {
    const activityTypeRaw = session.activityType ?? session.activityTypeId ?? session.activity ?? '';
    const activityType = String(activityTypeRaw || '').toLowerCase();
    const sessionName = String(session.name || '').toLowerCase();
    const sessionDescription = String(session.description || '').toLowerCase();
    const numericType = Number(activityTypeRaw);
    const numericKey = Number.isFinite(numericType) ? String(numericType) : null;

    // Exclude explicitly excluded activities
    if (numericKey && excludedActivityCodes.has(numericKey)) {
      return false;
    }

    const isExplicitlyExcluded = excludedActivities.some(excluded => 
      activityType.includes(excluded) || 
      sessionName.includes(excluded) || 
      sessionDescription.includes(excluded)
    );
    
    if (isExplicitlyExcluded && !(numericKey && includedActivityCodes.has(numericKey))) {
      return false;
    }

    // Include if it's in the included activity codes
    if (numericKey && includedActivityCodes.has(numericKey)) {
      return true;
    }

    // Include if it matches exercise activities
    return exerciseActivities.some(activity => 
      activityType.includes(activity) || 
      sessionName.includes(activity) || 
      sessionDescription.includes(activity)
    );
  });
}

/**
 * Enhance sessions with distance and normalized names
 */
async function enhanceSessions(
  accessToken: string,
  sessions: any[]
): Promise<any[]> {
  const enhanced = [];

  for (const session of sessions) {
    // Fetch distance for this session
    const distance = await fetchSessionDistance(accessToken, session);
    
    // Normalize activity name
    const normalizedName = normalizeActivityName(session);

    enhanced.push({
      ...session,
      name: normalizedName || session.name,
      _computed_distance_meters: distance
    });

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return enhanced;
}

/**
 * Core function: Fetch Google Fit data for a single day
 * Used by all sync functions
 */
export async function fetchDayData(
  accessToken: string,
  startOfDay: Date,
  endOfDay: Date,
  options: SyncOptions = {}
): Promise<GoogleFitDayData> {
  const startTimeMillis = startOfDay.getTime();
  const endTimeMillis = endOfDay.getTime();

  // Fetch all metrics in parallel
  const [stepsData, caloriesData, activeMinutesData, heartRateData] = await Promise.all([
    fetchAggregate(accessToken, 'com.google.step_count.delta', startTimeMillis, endTimeMillis),
    fetchAggregate(accessToken, 'com.google.calories.expended', startTimeMillis, endTimeMillis),
    fetchAggregate(accessToken, 'com.google.active_minutes', startTimeMillis, endTimeMillis),
    fetchAggregate(accessToken, 'com.google.heart_rate.bpm', startTimeMillis, endTimeMillis).catch(() => null)
  ]);

  // Extract values from API responses
  const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
  const caloriesBurned = caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
  const activeMinutes = activeMinutesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
  const heartRateAvg = heartRateData?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal;

  // Fetch sessions
  const allSessions = await fetchSessions(accessToken, startOfDay, endOfDay);
  
  // Filter to only exercise sessions
  const exerciseSessions = filterExerciseSessions(allSessions);
  
  // Enhance sessions with distance data
  const enhancedSessions = await enhanceSessions(accessToken, exerciseSessions);

  // Calculate total distance from sessions
  const distanceMeters = enhancedSessions.reduce((sum, session) => {
    return sum + (session._computed_distance_meters || 0);
  }, 0);

  return {
    steps,
    caloriesBurned,
    activeMinutes,
    distanceMeters,
    heartRateAvg,
    sessions: enhancedSessions
  };
}

/**
 * Store daily Google Fit data to database
 */
export async function storeDayData(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  data: GoogleFitDayData
): Promise<void> {
  // Store daily aggregate data
  const { error: dataError } = await supabase
    .from('google_fit_data')
    .upsert({
      user_id: userId,
      date: date,
      steps: data.steps,
      calories_burned: data.caloriesBurned,
      active_minutes: data.activeMinutes,
      distance_meters: data.distanceMeters,
      heart_rate_avg: data.heartRateAvg,
      sessions: data.sessions,
      synced_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,date'
    });

  if (dataError) {
    console.error('Error storing daily data:', dataError);
    throw new Error(`Failed to store daily data: ${dataError.message}`);
  }

  // Store individual sessions
  if (data.sessions && data.sessions.length > 0) {
    const sessionRecords = data.sessions.map(session => ({
      user_id: userId,
      session_id: session.id,
      activity_type: session.activityType ?? session.activityTypeId ?? session.activity,
      name: session.name,
      description: session.description,
      start_time: new Date(Number(session.startTimeMillis)).toISOString(),
      end_time: new Date(Number(session.endTimeMillis)).toISOString(),
      raw: session
    }));

    const { error: sessionError } = await supabase
      .from('google_fit_sessions')
      .upsert(sessionRecords, {
        onConflict: 'user_id,session_id'
      });

    if (sessionError) {
      console.warn('Warning: Failed to store some sessions:', sessionError);
      // Don't throw - daily data is more important
    }
  }
}

/**
 * Fetch and store data for multiple days
 * Used by historical sync and batch sync
 */
export async function syncMultipleDays(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  daysBack: number
): Promise<number> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000);
  
  console.log(`📅 Syncing ${daysBack} days for user ${userId}`);

  let syncedCount = 0;

  for (let i = 0; i < daysBack; i++) {
    const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const dateStr = currentDate.toISOString().split('T')[0];

    try {
      const dayData = await fetchDayData(accessToken, startOfDay, endOfDay);
      await storeDayData(supabase, userId, dateStr, dayData);
      syncedCount++;

      if (dayData.sessions.length > 0) {
        console.log(`   ✓ ${dateStr}: ${dayData.sessions.length} sessions`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (error) {
      console.warn(`⚠️  Failed to sync ${dateStr}:`, error);
      // Continue with other days
    }
  }

  return syncedCount;
}

/**
 * Check and refresh Google access token if expired
 */
export async function ensureValidToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  // Get token from database
  const { data: tokenData, error: tokenError } = await supabase
    .from('google_tokens')
    .select('access_token, expires_at, refresh_token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (tokenError || !tokenData?.access_token) {
    throw new Error('No valid Google Fit token found');
  }

  // Check if token is expired
  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);
  
  if (expiresAt <= now) {
    console.log('Token expired, refreshing...');
    
    // Refresh the token
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!refreshResponse.ok) {
      throw new Error('Failed to refresh Google token');
    }

    const refreshData = await refreshResponse.json();

    // Update token in database
    await supabase
      .from('google_tokens')
      .update({
        access_token: refreshData.access_token,
        expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('refresh_token', tokenData.refresh_token);

    console.log('Token refreshed successfully');
    return refreshData.access_token;
  }

  return tokenData.access_token;
}
