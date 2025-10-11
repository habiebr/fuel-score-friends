-- Add covering indexes for reported unindexed foreign keys

-- food_suggestions.user_id
CREATE INDEX IF NOT EXISTS food_suggestions_user_id_idx ON public.food_suggestions(user_id);

-- friends.friend_id and friends.user_id (assumed common lookups)
CREATE INDEX IF NOT EXISTS friends_friend_id_idx ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS friends_user_id_idx ON public.friends(user_id);

-- marathon_events.user_id
CREATE INDEX IF NOT EXISTS marathon_events_user_id_idx ON public.marathon_events(user_id);

-- user_subscriptions.user_id, user_subscriptions.meal_plan_id
CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_meal_plan_id_idx ON public.user_subscriptions(meal_plan_id);


