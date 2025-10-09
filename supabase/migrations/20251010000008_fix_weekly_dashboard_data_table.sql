-- Fix weekly dashboard data function to use nutrition_scores table
CREATE OR REPLACE FUNCTION get_weekly_dashboard_data(
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  -- Calculate week boundaries (Monday to Sunday)
  v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
  v_week_end := (v_week_start + INTERVAL '6 days')::DATE;

  WITH weekly_scores AS (
    SELECT 
      date,
      total_score as score,
      nutrition_score,
      training_score,
      bonuses,
      penalties
    FROM nutrition_scores -- Use the actual table name
    WHERE user_id = p_user_id
    AND date >= v_week_start
    AND date <= v_week_end
  ),
  weekly_google_fit AS (
    SELECT 
      date,
      distance_meters,
      steps,
      calories_burned,
      active_minutes
    FROM google_fit_data
    WHERE user_id = p_user_id
    AND date >= v_week_start
    AND date <= v_week_end
  ),
  weekly_targets AS (
    SELECT 
      target_type,
      target_value,
      start_date,
      end_date
    FROM user_targets
    WHERE user_id = p_user_id
    AND target_type IN ('weekly_distance', 'weekly_calories')
    AND start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE
  )
  SELECT json_build_object(
    'scores', (
      SELECT json_agg(row_to_json(weekly_scores.*))
      FROM weekly_scores
    ),
    'google_fit', (
      SELECT json_agg(row_to_json(weekly_google_fit.*))
      FROM weekly_google_fit
    ),
    'targets', (
      SELECT json_agg(row_to_json(weekly_targets.*))
      FROM weekly_targets
    ),
    'week_start', v_week_start,
    'week_end', v_week_end
  ) INTO v_result;

  RETURN v_result;
END;
$$;
