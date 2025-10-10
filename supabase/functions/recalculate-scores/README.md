# Score Recalculation Function

This Edge Function recalculates daily nutrition scores for users using the unified scoring formula.

## Features

- Recalculates scores for a specified number of past days (default: 30)
- Uses the unified scoring system with proper weights and modifiers
- Considers:
  - Nutrition targets and actuals
  - Training data from Google Fit
  - Meal timing and structure
  - Bonuses and penalties

## Usage

```typescript
const { data: { session } } = await supabase.auth.getSession();
const { data, error } = await supabase.functions.invoke('recalculate-scores', {
  body: { daysBack: 7 }, // Optional, defaults to 30
  headers: { 
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY 
  }
});
```

## Response

```json
{
  "success": true,
  "message": "Recalculated scores for 7 days",
  "data": [
    {
      "date": "2024-10-09",
      "score": 85,
      "breakdown": {
        "total": 85,
        "nutrition": {
          "total": 90,
          "macros": 95,
          "timing": 80,
          "structure": 85
        },
        "training": {
          "total": 75
        },
        "modifiers": {
          "bonuses": 5,
          "penalties": 0
        }
      }
    }
  ]
}
```

## Error Response

```json
{
  "success": false,
  "error": "Error message"
}
```

## Development

1. Deploy function:
```bash
supabase functions deploy recalculate-scores
```

2. Test locally:
```bash
supabase functions serve recalculate-scores --env-file ./supabase/.env.local
```
