-- Function to get all dashboard data in a single query
CREATE OR REPLACE FUNCTION get_dashboard_data(
  p_user_id UUID,
  p_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH nutrition_scores AS (
    SELECT *
    FROM nutrition_scores
    WHERE user_id = p_user_id
    AND date = p_date
  ),
  meal_plans AS (
    SELECT *
    FROM daily_meal_plans
    WHERE user_id = p_user_id
    AND date = p_date
  ),
  food_logs AS (
    SELECT *
    FROM food_logs
    WHERE user_id = p_user_id
    AND logged_at >= p_date::TIMESTAMP
    AND logged_at < (p_date + INTERVAL '1 day')::TIMESTAMP
  ),
  profile AS (
    SELECT age, sex, weight_kg, height_cm, activity_level
    FROM profiles
    WHERE user_id = p_user_id
  )
  SELECT json_build_object(
    'nutrition_score', (SELECT row_to_json(nutrition_scores.*) FROM nutrition_scores LIMIT 1),
    'meal_plans', (SELECT json_agg(row_to_json(meal_plans.*)) FROM meal_plans),
    'food_logs', (SELECT json_agg(row_to_json(food_logs.*)) FROM food_logs),
    'profile', (SELECT row_to_json(profile.*) FROM profile LIMIT 1)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
