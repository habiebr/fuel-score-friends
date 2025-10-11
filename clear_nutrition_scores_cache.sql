-- Clear nutrition_scores cache to force score recalculation
-- Run this to fix the "92 score" issue by forcing fresh calculation

-- Delete all cached scores (they will be regenerated on next dashboard load)
DELETE FROM nutrition_scores;

-- Alternatively, delete only today's scores:
-- DELETE FROM nutrition_scores WHERE date = CURRENT_DATE;

-- Or delete only old scores (older than 7 days):
-- DELETE FROM nutrition_scores WHERE date < CURRENT_DATE - INTERVAL '7 days';

-- Check current cached scores:
SELECT 
  user_id,
  date,
  daily_score,
  updated_at,
  CASE 
    WHEN updated_at < NOW() - INTERVAL '1 day' THEN 'STALE (>24h old)'
    WHEN updated_at < NOW() - INTERVAL '1 hour' THEN 'OLD (>1h old)'
    ELSE 'FRESH'
  END as cache_status
FROM nutrition_scores
ORDER BY date DESC, user_id
LIMIT 20;
