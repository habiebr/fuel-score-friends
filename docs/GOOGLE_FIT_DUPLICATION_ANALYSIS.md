# Google Fit Function Duplication Analysis

## Overview
Analysis of duplicated code across Google Fit edge functions.

## Major Duplications Found

### 1. Activity Type Mappings (HUGE DUPLICATION!)

**Duplicated in 4 files:**
- `fetch-google-fit-data/index.ts` (lines 114-165) - 51 lines
- `sync-all-users-direct/index.ts` (lines 21-66) - 45 lines  
- `sync-historical-google-fit-data/index.ts` (similar)
- `sync-historical-google-fit-data/index-improved.ts` (lines 16-49)

**Content:** Complete mapping of Google Fit activity type codes to friendly names:
```typescript
const activityTypeNames: Record<number, string> = {
  7: 'Walking',
  8: 'Running',
  9: 'Jogging',
  10: 'Sprinting',
  // ... 40+ more entries
}
```

**Impact:** ~50 lines duplicated across 4 files = **200 lines of duplicate code**

---

### 2. Exercise Activity Keywords (DUPLICATE!)

**Duplicated in 3 files:**
- `fetch-google-fit-data/index.ts` (lines 19-113) - 95 lines
- `sync-all-users-direct/index.ts` (lines 185-234) - 50 lines
- `sync-historical-google-fit-data/index.ts` (similar)

**Content:** List of exercise activity keywords for filtering:
```typescript
const exerciseActivities = [
  'running', 'jogging', 'sprint', 'marathon',
  'cycling', 'biking', 'bike',
  'swimming', 'swim',
  'hiking', 'trail_running',
  // ... 50+ more activities
];
```

**Impact:** ~70 lines duplicated across 3 files = **210 lines of duplicate code**

---

### 3. Running Activity Detection (DUPLICATE!)

**Duplicated in 2 files:**
- `weekly-running-leaderboard/index.ts` (lines 11-26)
- `aggregate-weekly-activity/index.ts` (lines 9-44)

**Content:**
```typescript
const RUN_KEYWORDS = [
  'run', 'jog', 'marathon', 'trail',
  'treadmill', 'road run', 'half', '5k', '10k'
];

const RUN_ACTIVITY_CODES = new Set([
  '8', '57', '58', '59', '72',
  '173', '174', '175', '176', '177', '178', '179', '180',
  '181', '182', '183', '184', '185', '186', '187', '188',
  '3000', '3001'
]);

function isRunningSession(session) { /* ... */ }
```

**Impact:** ~60 lines duplicated = **120 lines of duplicate code**

---

### 4. Session Normalization (DUPLICATE!)

**Duplicated in:**
- `sync-all-users-direct/index.ts` (lines 67-82)
- Similar logic in `fetch-google-fit-data`
- Similar logic in `sync-historical-google-fit-data`

**Content:**
```typescript
function normalizeSession(session: any) {
  const copy = { ...session };
  const activityTypeRaw = copy.activityType ?? copy.activityTypeId ?? copy.activity;
  const numericType = Number(activityTypeRaw);
  if (!Number.isNaN(numericType)) {
    copy._activityTypeNumeric = numericType;
  }
  if (!copy.name || !String(copy.name).trim()) {
    const friendly = activityTypeNames[numericType];
    if (friendly) {
      copy.name = friendly;
      copy.description = friendly;
    }
  }
  return copy;
}
```

**Impact:** ~15 lines duplicated across 3 files = **45 lines**

---

### 5. Distance Extraction (DUPLICATE!)

**Duplicated in:**
- `weekly-running-leaderboard/index.ts` - `extractDistanceMeters()`
- `update-actual-training/index.ts` - `extractDistance()`

**Content:** Logic to extract distance from various field names

---

## Total Duplication Impact

| Component | Files | Lines Each | Total Duplicate Lines |
|-----------|-------|------------|----------------------|
| Activity Type Mappings | 4 | 50 | **200 lines** |
| Exercise Keywords | 3 | 70 | **210 lines** |
| Running Detection | 2 | 60 | **120 lines** |
| Session Normalization | 3 | 15 | **45 lines** |
| Distance Extraction | 2 | 20 | **40 lines** |
| **TOTAL** | | | **615 lines** |

---

## Proposed Solution

### Create Shared Module: `_shared/google-fit-activities.ts`

```typescript
/**
 * Google Fit Activity Type Mappings and Utilities
 * Shared across all Google Fit sync functions
 */

// Activity type code to friendly name mapping
export const activityTypeNames: Record<number, string> = {
  7: 'Walking',
  8: 'Running',
  9: 'Jogging',
  // ... complete mapping
};

// Exercise activity keywords for filtering
export const exerciseActivities = [
  'running', 'jogging', 'sprint',
  'cycling', 'biking', 'swimming',
  // ... complete list
];

// Running-specific detection
export const RUN_KEYWORDS = [
  'run', 'jog', 'marathon', 'trail',
  'treadmill', 'road run', 'half', '5k', '10k'
];

export const RUN_ACTIVITY_CODES = new Set([
  '8', '57', '58', '59', '72',
  '173', '174', '175', // ... complete set
]);

// Activity codes to include (exercise only, no walking)
export const INCLUDED_ACTIVITY_CODES = new Set([
  '8', '9', '10', '57', '58', '59', '70', '71', '72',
  // ... complete set
]);

// Activity codes to exclude (walking, etc.)
export const EXCLUDED_ACTIVITY_CODES = new Set([
  '7', '93', '94', '143', '145'
]);

// Utility functions
export function normalizeSession(session: any) {
  const copy = { ...session };
  const activityTypeRaw = copy.activityType ?? copy.activityTypeId ?? copy.activity ?? '';
  const numericType = Number(activityTypeRaw);
  
  if (!Number.isNaN(numericType)) {
    copy._activityTypeNumeric = numericType;
  }
  
  if (!copy.name || !String(copy.name).trim()) {
    const friendly = activityTypeNames[numericType];
    if (friendly) {
      copy.name = friendly;
      if (!copy.description) {
        copy.description = friendly;
      }
    }
  }
  
  return copy;
}

export function isRunningSession(session: any): boolean {
  if (!session) return false;
  
  const candidates = [
    session?.activity_type,
    session?.activityType,
    session?.activity,
    session?.activityTypeId,
    session?.name,
    session?.description,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const text = String(candidate).toLowerCase();
    
    if (RUN_KEYWORDS.some(keyword => text.includes(keyword))) {
      return true;
    }
    
    if (RUN_ACTIVITY_CODES.has(text)) {
      return true;
    }
    
    const numeric = Number(candidate);
    if (!Number.isNaN(numeric) && RUN_ACTIVITY_CODES.has(String(numeric))) {
      return true;
    }
  }
  
  return false;
}

export function isExerciseActivity(session: any): boolean {
  if (!session) return false;
  
  const candidates = [
    session?.activity_type,
    session?.activityType,
    session?.activity,
    session?.name,
    session?.description,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const text = String(candidate).toLowerCase();
    
    // Check if it's an exercise activity
    if (exerciseActivities.some(activity => text.includes(activity))) {
      return true;
    }
  }
  
  // Check by numeric code
  const numericType = Number(session?.activityType ?? session?.activityTypeId);
  if (!Number.isNaN(numericType)) {
    return INCLUDED_ACTIVITY_CODES.has(String(numericType)) &&
           !EXCLUDED_ACTIVITY_CODES.has(String(numericType));
  }
  
  return false;
}

export function extractDistanceMeters(session: any): number {
  if (!session) return 0;
  
  const candidates = [
    session?._computed_distance_meters,
    session?.distance_meters,
    session?.distanceMeters,
    session?.raw?._computed_distance_meters,
    session?.raw?.distance_meters,
    session?.raw?.distanceMeters,
    session?.raw?.metrics?.distance,
    session?.raw?.metrics?.distance_meters,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

export function getFriendlyActivityName(activityType: number | string | undefined): string | null {
  if (activityType == null) return null;
  
  const numericType = Number(activityType);
  if (Number.isNaN(numericType)) return null;
  
  return activityTypeNames[numericType] || null;
}
```

---

## Implementation Plan

### Priority 1: Create Shared Module ✅
- Create `supabase/functions/_shared/google-fit-activities.ts`
- Extract all duplicated constants and functions
- Add comprehensive JSDoc comments

### Priority 2: Update Functions to Use Shared Module
Update these files to import from shared module:
1. `fetch-google-fit-data/index.ts`
2. `sync-all-users-direct/index.ts`
3. `sync-historical-google-fit-data/index.ts`
4. `weekly-running-leaderboard/index.ts`
5. `aggregate-weekly-activity/index.ts`
6. `update-actual-training/index.ts`

### Priority 3: Remove Duplicates
Delete all duplicated code from individual functions

### Priority 4: Deploy and Test
- Deploy updated functions
- Test historical sync
- Test real-time sync
- Test weekly running leaderboard
- Test aggregate weekly activity

---

## Benefits After Implementation

✅ **Code Reduction:** Remove ~615 lines of duplicate code  
✅ **Maintainability:** Update activity mappings in ONE place  
✅ **Consistency:** All functions use identical logic  
✅ **Bug Fixes:** Fix once, applies everywhere  
✅ **Clarity:** Single source of truth for activity definitions  

---

## Risk Assessment

**Low Risk:**
- Only extracting existing code to shared module
- No logic changes
- All functions will import same constants/functions
- Easy to test and rollback if needed

---

## Current Status

- ⚠️ **615 lines of duplicate code** across 6 functions
- ⚠️ Maintenance nightmare - changes must be made in 6 places
- ⚠️ Inconsistency risk - functions may drift apart
- ⚠️ Activity type mappings hardcoded in multiple places

**Recommendation:** PROCEED WITH CONSOLIDATION IMMEDIATELY
