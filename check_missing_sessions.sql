-- Find sessions in google_fit_sessions not present in google_fit_data.sessions
-- (by user and session_id, last 7 days)

WITH all_sessions AS (
  SELECT user_id, session_id, start_time
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
SELECT a.user_id, a.session_id, a.start_time
FROM all_sessions a
LEFT JOIN flattened_data_sessions f
  ON a.user_id = f.user_id AND a.session_id = f.session_id
WHERE f.session_id IS NULL
ORDER BY a.start_time DESC;

-- This will list sessions in the sessions table that are NOT in the data table's sessions array.
-- If the result is empty, all sessions are matched. If not, these are the missing ones.
