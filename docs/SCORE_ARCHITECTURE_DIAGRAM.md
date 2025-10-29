# Score Calculation Architecture - Complete Flow

## Daily Score Calculation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER REQUEST (UI Component)                   │
│                  Dashboard / CachedDashboard                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               getTodayUnifiedScore(userId)                       │
│          src/services/unified-score.service.ts                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
    ┌────────────────────┐   ┌──────────────────────┐
    │  Fetch User Data   │   │  Fetch Nutrition     │
    │  - Profile         │   │  - Meal Plans        │
    │  - Weight          │   │  - Food Logs         │
    └────────┬───────────┘   └──────────┬───────────┘
             │                          │
             └──────────┬───────────────┘
                        ▼
         ┌──────────────────────────────────┐
         │  createScoringContext()          │
         │  Build complete context object   │
         └──────────────┬───────────────────┘
                        ▼
         ┌──────────────────────────────────┐
         │  calculateUnifiedScore(context)  │
         │  src/lib/unified-scoring.ts      │
         └──────────────┬───────────────────┘
                        │
      ┌─────────────────┼─────────────────┐
      ▼                 ▼                 ▼
┌──────────┐    ┌──────────────┐   ┌──────────┐
│Nutrition │    │   Training   │   │Modifiers │
│  Score   │    │    Score     │   │(Bonus/   │
│          │    │              │   │Penalty)  │
│50% Macros│    │60% Completion│   │Max ±15   │
│35% Timing│    │25% Type Match│   │          │
│15% Struct│    │15% Intensity │   │          │
└────┬─────┘    └──────┬───────┘   └────┬─────┘
     │                 │                 │
     └────────┬────────┴────────┬────────┘
              ▼                 ▼
    ┌──────────────────────────────────┐
    │    Apply Load-Based Weights      │
    │  Rest: 100% N / 0% T             │
    │  Easy: 70% N / 30% T             │
    │  Moderate: 60% N / 40% T         │
    │  Long: 55% N / 45% T             │
    │  Quality: 60% N / 40% T          │
    └──────────────┬───────────────────┘
                   ▼
    ┌──────────────────────────────────┐
    │  Final Score = (N × wN) +        │
    │                (T × wT) +        │
    │                Bonuses +         │
    │                Penalties         │
    │  Clamped to [0, 100]             │
    └──────────────┬───────────────────┘
                   ▼
    ┌──────────────────────────────────┐
    │  Persist to nutrition_scores     │
    │  table for caching               │
    └──────────────┬───────────────────┘
                   ▼
    ┌──────────────────────────────────┐
    │  Return ScoreResult              │
    │  {score, breakdown, context}     │
    └──────────────────────────────────┘
```

---

## Weekly Score Calculation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER REQUEST (UI Component)                   │
│     Dashboard / CachedDashboard / Community (Leaderboard)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐     ┌─────────────────────────────────┐
│getWeeklyUnifiedScore()│     │  getWeeklyScoreFromCache()      │
│(CachedDashboard)      │     │  (Dashboard)                    │
│                       │     │                                 │
│Strategy param for     │     │  Direct cache read              │
│API compatibility      │     │                                 │
└──────────┬────────────┘     └──────────┬──────────────────────┘
           │                             │
           └──────────────┬──────────────┘
                          │ Both delegate to
                          ▼
           ┌─────────────────────────────────────┐
           │  getWeeklyScoreFromCache()          │
           │  src/services/unified-score.service │
           └──────────────┬──────────────────────┘
                          ▼
           ┌─────────────────────────────────────┐
           │  Query nutrition_scores table       │
           │  - Filter: user_id, date range      │
           │  - Week: Monday to Sunday (7 days)  │
           └──────────────┬──────────────────────┘
                          ▼
           ┌─────────────────────────────────────┐
           │  Extract daily_score for each day   │
           │  [Day1: 85, Day2: 90, Day3: 0, ...] │
           └──────────────┬──────────────────────┘
                          ▼
           ┌─────────────────────────────────────┐
           │  Filter out zero/invalid scores     │
           │  validScores = scores.filter(s > 0) │
           └──────────────┬──────────────────────┘
                          ▼
           ┌─────────────────────────────────────┐
           │  Calculate Average                  │
           │  average = Σ(validScores) / count   │
           │  Result: 0-100 range                │
           └──────────────┬──────────────────────┘
                          ▼
           ┌─────────────────────────────────────┐
           │  Return Result                      │
           │  {average: 87, dailyScores: [...]}  │
           └─────────────────────────────────────┘
```

---

## Leaderboard Weekly Score Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Community.tsx (Leaderboard)                   │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
           ┌─────────────────────────────────────────┐
           │  getAllUsersWeeklyScoresFromCache()     │
           │  src/services/unified-score.service     │
           └──────────────┬──────────────────────────┘
                          ▼
           ┌─────────────────────────────────────────┐
           │  Query nutrition_scores for ALL users   │
           │  - Week range: Monday to Sunday         │
           │  - Group by: user_id                    │
           └──────────────┬──────────────────────────┘
                          ▼
           ┌─────────────────────────────────────────┐
           │  For each user:                         │
           │  1. Collect all daily scores            │
           │  2. Filter valid scores (> 0)           │
           │  3. Calculate average                   │
           └──────────────┬──────────────────────────┘
                          ▼
           ┌─────────────────────────────────────────┐
           │  Return Array of User Scores            │
           │  [{user_id, weekly_score, daily_scores}]│
           └─────────────────────────────────────────┘
```

---

## Score Component Breakdown

### Nutrition Score Components (Runner-Focused)

```
NUTRITION SCORE = (Macros × 0.50) + (Timing × 0.35) + (Structure × 0.15)

┌─────────────────────────────────────────────────────────┐
│                    MACROS (50%)                         │
│  = (Cal×0.3) + (Carbs×0.4) + (Protein×0.2) + (Fat×0.1)  │
│                                                          │
│  Piecewise Function for each macro:                     │
│  ± 5% error  → 100 points                               │
│  ± 10% error → 60 points                                │
│  ± 20% error → 20 points                                │
│  > 20% error → 0 points                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   TIMING (35%)                          │
│  = (Pre × 0.4) + (During × 0.4) + (Post × 0.2)         │
│                                                          │
│  Pre-Workout:  ≥80% carbs in window → 100, else 0      │
│  During:       Linear ±10g→100pts, ±30g→0pts            │
│  Post-Workout: ≥80% carbs+protein in window → 100, else 0│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  STRUCTURE (15%)                        │
│  Breakfast: 25 pts  │  Lunch: 25 pts                    │
│  Dinner: 25 pts     │  Snack: 25 pts (if training day)  │
│                                                          │
│  Penalty: Max 70 if single meal > 60% of calories       │
└─────────────────────────────────────────────────────────┘
```

### Training Score Components

```
TRAINING SCORE = (Completion × 0.60) + (Type × 0.25) + (Intensity × 0.15)

┌─────────────────────────────────────────────────────────┐
│                 COMPLETION (60%)                        │
│  90-110% of planned duration  → 100 points              │
│  75-125% of planned duration  → 60 points               │
│  Otherwise                    → 0 points                │
│                                                          │
│  Note: If no HR data, this becomes 75% weight           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                TYPE MATCH (25%)                         │
│  Same activity family (run/bike/swim) → 100 points      │
│  Different activity            → 0 points               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               INTENSITY (15%)                           │
│  Within target HR zone  → 100 points                    │
│  Near target HR zone    → 60 points                     │
│  Otherwise              → 0 points                      │
│                                                          │
│  Note: If no HR data, weight redistributed to completion│
└─────────────────────────────────────────────────────────┘
```

### Bonuses & Penalties

```
┌─────────────────────────────────────────────────────────┐
│                 BONUSES (Max +10)                       │
│  ✓ All fueling windows synced  → +5                     │
│  ✓ Streak days                 → +1 per day (max +5)    │
│  ✓ Hydration target met        → +2                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                PENALTIES (Max -15)                      │
│  ✗ Hard day + underfueled      → -5                     │
│  ✗ Big deficit on 90+ min run  → -10                    │
│  ✗ Missed post-workout window  → -3                     │
│  ✗ Overconsumption (>115% cal) → -10                    │
└─────────────────────────────────────────────────────────┘
```

---

## Load-Based Weight Matrix

```
┌─────────────┬────────────┬─────────────┬──────────────────────┐
│ Load Type   │ Nutrition  │  Training   │  Use Case            │
├─────────────┼────────────┼─────────────┼──────────────────────┤
│ Rest        │   100%     │     0%      │  Recovery day        │
│ Easy        │    70%     │    30%      │  Easy run/jog        │
│ Moderate    │    60%     │    40%      │  Tempo run           │
│ Long        │    55%     │    45%      │  Long run (marathon) │
│ Quality     │    60%     │    40%      │  Intervals/speed     │
└─────────────┴────────────┴─────────────┴──────────────────────┘
```

---

## Data Persistence

```
┌─────────────────────────────────────────────────────────────┐
│              nutrition_scores Table (Cache)                 │
├─────────────────────────────────────────────────────────────┤
│  user_id              │  UUID (FK to profiles)              │
│  date                 │  DATE (YYYY-MM-DD)                  │
│  daily_score          │  INTEGER (0-100)                    │
│  calories_consumed    │  INTEGER                            │
│  protein_grams        │  REAL                               │
│  carbs_grams          │  REAL                               │
│  fat_grams            │  REAL                               │
│  meals_logged         │  INTEGER                            │
│  planned_calories     │  INTEGER                            │
│  planned_protein_grams│  REAL                               │
│  planned_carbs_grams  │  REAL                               │
│  planned_fat_grams    │  REAL                               │
│  updated_at           │  TIMESTAMP                          │
└─────────────────────────────────────────────────────────────┘

Primary Key: (user_id, date)
Indexes: user_id, date
Used for: Daily & Weekly score caching
```

---

## Key Differences: Old vs New

```
┌──────────────────────┬──────────────────┬───────────────────┐
│                      │   OLD (Legacy)   │   NEW (Unified)   │
├──────────────────────┼──────────────────┼───────────────────┤
│ Daily Score Range    │     0-100        │      0-100        │
│ Weekly Score Range   │     0-700 ❌     │      0-100 ✅     │
│ Weekly Calculation   │   SUM scores     │   AVERAGE scores  │
│ Formula Location     │  dailyScore.ts   │ unified-scoring.ts│
│ Service Function     │   dailyScore()   │calculateUnifiedScore()│
│ Caching              │     None         │ nutrition_scores  │
│ Strategy Support     │     None         │ runner/general    │
└──────────────────────┴──────────────────┴───────────────────┘
```
