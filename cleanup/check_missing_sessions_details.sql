-- Show details for sessions missing from google_fit_data.sessions
-- (last 7 days)

WITH all_sessions AS (
  SELECT user_id, session_id, start_time, end_time, activity_type, name, description, source, raw
  FROM google_fit_sessions
  WHERE start_time >= CURRENT_DATE - INTERVAL '7 days'
),
flattened_data_sessions AS (
  SELECT
    d.user_id,
    d.date,
    s->>'id' AS session_id
  FROM google_fit_data d
  CROSS JOIN LATERAL jsonb_array_elements(d.sessions) AS s
  WHERE d.date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT a.user_id, a.session_id, a.start_time, a.end_time, a.activity_type, a.name, a.description, a.source, a.raw
FROM all_sessions a
LEFT JOIN flattened_data_sessions f
  ON a.user_id = f.user_id AND a.session_id = f.session_id
WHERE f.session_id IS NULL
ORDER BY a.start_time DESC;

-- This will show all fields for the missing sessions so you can analyze why they were not included in the daily data.
