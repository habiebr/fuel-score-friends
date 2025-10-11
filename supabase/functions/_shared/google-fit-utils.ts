/**
 * Google Fit Utility Functions
 * 
 * This module contains utility functions for processing Google Fit data,
 * including session normalization, distance extraction, and activity detection.
 * 
 * Consolidates ~205 lines of duplicate code from:
 * - fetch-google-fit-data
 * - sync-all-users-direct
 * - sync-historical-google-fit-data
 * - weekly-running-leaderboard
 * - aggregate-weekly-activity
 * - update-actual-training
 */

import {
  activityTypeNames,
  RUN_KEYWORDS,
  RUN_ACTIVITY_CODES,
  includedActivityCodes,
  excludedActivityCodes,
  exerciseActivities,
  excludedActivities
} from './google-fit-activities.ts';

/**
 * Normalize activity name from session data
 * Attempts to extract a friendly activity name from session data
 * 
 * @param session - Google Fit session object
 * @returns Normalized activity name or null
 */
export function normalizeActivityName(session: any): string | null {
  if (!session) return null;
  
  // First, try to get existing name or description
  const existing = String(session.name || session.description || '').trim();
  if (existing) return existing;
  
  // If no name/description, try to map from numeric activity type
  const numericType = Number(session.activityType ?? session.activityTypeId ?? session.activity);
  if (!Number.isNaN(numericType) && activityTypeNames[numericType]) {
    return activityTypeNames[numericType];
  }
  
  return null;
}

/**
 * Check if a session is a running activity
 * Used by weekly-running-leaderboard and aggregate-weekly-activity
 * 
 * @param session - Google Fit session object
 * @returns true if the session is a running activity
 */
export function isRunningSession(session: Record<string, unknown> | null | undefined): boolean {
  if (!session) return false;
  
  // Collect all possible activity indicators
  const candidates = [
    session?.activity_type,
    session?.activityType,
    session?.activity,
    session?.activityTypeId,
    session?.name,
    session?.description,
    (session as any)?.raw?.activity_type,
    (session as any)?.raw?.activityType,
    (session as any)?.raw?.activity,
    (session as any)?.raw?.activityTypeId,
    (session as any)?.raw?.name,
    (session as any)?.raw?.description,
  ];

  // Check each candidate against keywords and activity codes
  for (const candidate of candidates) {
    if (candidate == null) continue;
    
    // Check text-based keywords
    const text = String(candidate).toLowerCase();
    if (RUN_KEYWORDS.some(keyword => text.includes(keyword))) {
      return true;
    }
    
    // Check activity codes (as string)
    if (RUN_ACTIVITY_CODES.has(text)) {
      return true;
    }
    
    // Check activity codes (as number)
    const numeric = Number(candidate);
    if (!Number.isNaN(numeric) && RUN_ACTIVITY_CODES.has(String(numeric))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a session is a valid exercise activity
 * More general than isRunningSession - includes all exercise types
 * 
 * @param session - Google Fit session object
 * @returns true if the session is a valid exercise
 */
export function isExerciseSession(session: any): boolean {
  if (!session) return false;

  // Check numeric activity code first
  const activityCode = String(
    session.activityType ?? 
    session.activityTypeId ?? 
    session.activity ?? 
    (session.raw?.activityType) ?? 
    (session.raw?.activityTypeId) ?? 
    (session.raw?.activity) ?? 
    ''
  );

  // Explicitly included activity codes
  if (includedActivityCodes.has(activityCode)) {
    return true;
  }

  // Explicitly excluded activity codes
  if (excludedActivityCodes.has(activityCode)) {
    return false;
  }

  // Check name/description for exercise keywords
  const nameOrDesc = String(
    session.name || 
    session.description || 
    (session.raw?.name) || 
    (session.raw?.description) || 
    ''
  ).toLowerCase();

  // Check for excluded activities first
  if (excludedActivities.some(excluded => nameOrDesc.includes(excluded))) {
    return false;
  }

  // Check for included exercise activities
  if (exerciseActivities.some(exercise => nameOrDesc.includes(exercise))) {
    return true;
  }

  return false;
}

/**
 * Extract distance in meters from session data
 * Tries multiple possible locations for distance data
 * 
 * @param session - Google Fit session object
 * @returns Distance in meters, or 0 if not found
 */
export function extractDistanceMeters(session: Record<string, unknown> | null | undefined): number {
  if (!session) return 0;
  
  // Try all possible locations for distance data
  const candidates = [
    (session as any)?._computed_distance_meters,
    (session as any)?.distance_meters,
    (session as any)?.distanceMeters,
    (session as any)?.raw?._computed_distance_meters,
    (session as any)?.raw?.distance_meters,
    (session as any)?.raw?.distanceMeters,
    (session as any)?.raw?.metrics?.distance,
    (session as any)?.raw?.metrics?.distance_meters,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

/**
 * Get a unique key for a session
 * Used to deduplicate sessions when processing multiple data sources
 * 
 * @param session - Google Fit session object
 * @returns Unique session key or null
 */
export function getSessionKey(session: Record<string, unknown> | null | undefined): string | null {
  if (!session) return null;
  
  // Try to get session ID first
  const id =
    (session as any)?.session_id ??
    (session as any)?.id ??
    (session as any)?.raw?.session_id ??
    (session as any)?.raw?.id;
  
  if (id) return String(id);

  // Fall back to start-end time combination
  const start =
    (session as any)?.start_time ??
    (session as any)?.startTimeMillis ??
    (session as any)?.raw?.start_time ??
    (session as any)?.raw?.startTimeMillis;
  
  const end =
    (session as any)?.end_time ??
    (session as any)?.endTimeMillis ??
    (session as any)?.raw?.end_time ??
    (session as any)?.raw?.endTimeMillis;

  if (start && end) {
    return `${start}-${end}`;
  }

  return null;
}

/**
 * Normalize a Google Fit session object
 * Standardizes session data structure for consistent processing
 * 
 * @param session - Raw Google Fit session object
 * @returns Normalized session object
 */
export function normalizeSession(session: any): any {
  if (!session) return null;

  return {
    session_id: session.id || session.session_id,
    activity_type: session.activityType ?? session.activityTypeId ?? session.activity,
    name: normalizeActivityName(session),
    description: session.description || session.name || null,
    start_time: session.startTimeMillis 
      ? new Date(Number(session.startTimeMillis)).toISOString() 
      : session.start_time,
    end_time: session.endTimeMillis 
      ? new Date(Number(session.endTimeMillis)).toISOString() 
      : session.end_time,
    active_duration_ms: session.activeTimeMillis ?? session.active_duration_ms,
    raw: session,
    _computed_distance_meters: extractDistanceMeters(session),
  };
}
