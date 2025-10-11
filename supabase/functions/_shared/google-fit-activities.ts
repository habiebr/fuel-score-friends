/**
 * Google Fit Activity Constants and Mappings
 * 
 * This module contains all Google Fit specific activity type mappings,
 * keywords, and activity code definitions used across multiple edge functions.
 * 
 * Consolidates ~410 lines of duplicate code from:
 * - fetch-google-fit-data
 * - sync-all-users-direct
 * - sync-historical-google-fit-data
 * - weekly-running-leaderboard
 * - aggregate-weekly-activity
 * - update-actual-training
 */

/**
 * Exercise activities to include in fitness tracking
 * Used to identify valid exercise sessions from activity names/descriptions
 */
export const exerciseActivities = [
  'running', 'jogging', 'sprint', 'marathon', 'half_marathon', '5k', '10k',
  'cycling', 'biking', 'bike', 'road_cycling', 'mountain_biking', 'indoor_cycling',
  'swimming', 'swim', 'pool_swimming', 'open_water_swimming',
  'hiking', 'trail_running', 'mountain_hiking',
  'elliptical', 'elliptical_trainer',
  'rowing', 'indoor_rowing', 'outdoor_rowing',
  'soccer', 'football', 'basketball', 'tennis', 'volleyball', 'badminton',
  'golf', 'golfing',
  'skiing', 'alpine_skiing', 'cross_country_skiing', 'snowboarding',
  'skating', 'ice_skating', 'roller_skating', 'inline_skating',
  'dancing', 'aerobic_dance', 'zumba', 'salsa', 'hip_hop',
  'aerobics', 'step_aerobics', 'water_aerobics',
  'strength_training', 'weight_lifting', 'weight_training', 'resistance_training',
  'crossfit', 'functional_fitness',
  'yoga', 'power_yoga', 'hot_yoga', 'vinyasa_yoga',
  'pilates', 'mat_pilates', 'reformer_pilates',
  'martial_arts', 'karate', 'taekwondo', 'judo', 'boxing', 'kickboxing', 'muay_thai',
  'climbing', 'rock_climbing', 'indoor_climbing', 'bouldering',
  'surfing', 'kayaking', 'canoeing', 'paddleboarding',
  'triathlon', 'duathlon', 'athletics', 'track_and_field',
  'gymnastics', 'calisthenics', 'plyometrics',
  'kickboxing', 'boxing', 'mma', 'wrestling',
  'rugby', 'hockey', 'lacrosse', 'baseball', 'softball',
  'cricket', 'squash', 'racquetball', 'handball',
  'archery', 'shooting', 'fencing',
  'rowing_machine', 'treadmill', 'stair_climbing', 'stair_master'
];

/**
 * Activities to explicitly exclude from fitness tracking
 * (e.g., walking, commuting - too low intensity)
 */
export const excludedActivities = [
  'walking', 'walk', 'strolling', 'leisurely_walk', 'casual_walk',
  'dog_walking', 'power_walking', 'brisk_walking',
  'commuting', 'transportation', 'travel'
];

/**
 * Google Fit activity codes that should always be treated as runs/workouts
 * These are numeric activity type IDs from Google Fit API
 */
export const includedActivityCodes = new Set([
  '8', // Running
  '9', // Jogging
  '10', // Sprinting
  '57', // Running on sand
  '58', // Running on stairs
  '59', // Running on treadmill
  '70', // Mountain biking
  '71', // Road biking
  '72', // Trail running
  '108', // Nordic walking (treat as run)
  '112', // CrossFit
  '113', // Functional training
  '116', // High-intensity interval training
  '117', // Spinning
  '118', // Stair climbing
  '119', // Indoor cycling
  '120', // Aquabiking
  '122', // Treadmill running
  '123', // Bicycle racing
  '124', // Jumping rope
  '129', // Roller skiing
  '134', // Trail biking
  '135', // High-intensity interval training
  '136', // Jumping rope
  '138', // Mountain biking
  '157', // Hiking (count as run equivalent)
  '169', // Swimming
  '170', // Swimming (open water)
  '171', // Swimming (pool)
  '173', // Running (general)
  '174', // Running on treadmill
  '175', // Running outdoors
  '176', // Running - high intensity
  '177', // Running - sprint
  '178', // Running - intervals
  '179', // Running - long distance
  '180', // Running - recovery
  '181', // Running - tempo
  '182', // Running - track
  '183', // Running - cross country
  '184', // Running - hill
  '185', // Running - race
  '186', // Running - warmup
  '187', // Running - cooldown
  '188', // Running - fartlek
  '3000', // Custom running activity
  '3001'
]);

/**
 * Google Fit activity codes to exclude from fitness tracking
 */
export const excludedActivityCodes = new Set([
  '7', // Walking
  '93', // Leisure walking
  '94', // Walking (fitness) - treat as excluded unless keyword says otherwise
  '143', // Wheelchair
  '145'  // Fitness walking
]);

/**
 * Running-specific keywords for activity detection
 * Used to identify running activities from session names/descriptions
 */
export const RUN_KEYWORDS = [
  'run',
  'jog',
  'marathon',
  'trail',
  'treadmill',
  'road run',
  'half',
  '5k',
  '10k'
];

/**
 * Running-specific activity codes
 * Subset of includedActivityCodes specifically for running
 */
export const RUN_ACTIVITY_CODES = new Set([
  '8', '57', '58', '59', '72',
  '173', '174', '175', '176', '177', '178', '179', '180', '181', '182', '183', '184', '185', '186', '187', '188',
  '3000', '3001'
]);

/**
 * Google Fit activity type ID to friendly name mapping
 * Provides human-readable names for Google Fit's numeric activity type codes
 */
export const activityTypeNames: Record<number, string> = {
  7: 'Walking',
  8: 'Running',
  9: 'Jogging',
  10: 'Sprinting',
  57: 'Beach Run',
  58: 'Stair Run',
  59: 'Treadmill Run',
  70: 'Extreme Biking',
  71: 'Road Biking',
  72: 'Trail Run',
  108: 'Nordic Walking',
  112: 'CrossFit',
  113: 'Functional Training',
  116: 'HIIT',
  117: 'Spinning',
  118: 'Stair Climb',
  119: 'Indoor Cycling',
  122: 'Treadmill Run',
  123: 'Cycle Race',
  124: 'Jump Rope',
  134: 'Trail Bike',
  135: 'HIIT',
  138: 'Mountain Biking',
  157: 'Hiking',
  169: 'Swimming',
  170: 'Open Water Swim',
  171: 'Pool Swim',
  173: 'Running',
  174: 'Treadmill Running',
  175: 'Outdoor Running',
  176: 'High Intensity Run',
  177: 'Sprint',
  178: 'Interval Run',
  179: 'Long Run',
  180: 'Recovery Run',
  181: 'Tempo Run',
  182: 'Track Run',
  183: 'Cross Country Run',
  184: 'Hill Run',
  185: 'Race',
  186: 'Warmup Run',
  187: 'Cooldown Run',
  188: 'Fartlek Run',
};
