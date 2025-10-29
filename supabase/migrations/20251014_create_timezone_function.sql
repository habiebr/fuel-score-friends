-- Create a function to fetch Google Fit sessions for a specific date in a user's timezone
-- This properly handles timezone conversion using PostgreSQL's native timezone functions

CREATE OR REPLACE FUNCTION get_google_fit_sessions_for_date(
  p_user_id UUID,
  p_date DATE,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  session_id TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  activity_type TEXT,
  name TEXT,
  description TEXT,
  source TEXT,
  raw JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.session_id,
    s.start_time,
    s.end_time,
    s.activity_type,
    s.name,
    s.description,
    s.source,
    s.raw
  FROM google_fit_sessions s
  WHERE s.user_id = p_user_id
    AND s.start_time >= (make_timestamptz(
      EXTRACT(YEAR FROM p_date)::INTEGER,
      EXTRACT(MONTH FROM p_date)::INTEGER,
      EXTRACT(DAY FROM p_date)::INTEGER,
      0, 0, 0.0,
      p_timezone
    ) AT TIME ZONE 'UTC')
    AND s.start_time < (make_timestamptz(
      EXTRACT(YEAR FROM p_date)::INTEGER,
      EXTRACT(MONTH FROM p_date)::INTEGER,
      EXTRACT(DAY FROM p_date)::INTEGER,
      23, 59, 59.999,
      p_timezone
    ) AT TIME ZONE 'UTC');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_google_fit_sessions_for_date(UUID, DATE, TEXT) TO authenticated;

