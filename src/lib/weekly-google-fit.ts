import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, subDays } from 'date-fns';

export interface WeeklyGoogleFitData {
  totalDistanceKm: number;
  totalSteps: number;
  totalCaloriesBurned: number;
  totalActiveMinutes: number;
  averageHeartRate: number;
  days: {
    date: string;
    distanceKm: number;
    steps: number;
    caloriesBurned: number;
    activeMinutes: number;
    heartRate?: number;
  }[];
}

/**
 * Get weekly Google Fit data for the current week (Monday to Sunday)
 * Uses database aggregation table for better performance
 * @param userId - User ID
 * @param weekStart - Optional week start date (defaults to current week Monday)
 * @returns Weekly Google Fit data
 */
export async function getWeeklyGoogleFitData(
  userId: string,
  weekStart?: Date
): Promise<WeeklyGoogleFitData> {
  try {
    // Calculate week boundaries (Monday to Sunday)
    const startDate = weekStart ? startOfWeek(weekStart, { weekStartsOn: 1 }) : startOfWeek(new Date(), { weekStartsOn: 1 });
    const startDateStr = format(startDate, 'yyyy-MM-dd');

    // First try to get from weekly aggregates table (faster)
    const { data: aggregateData, error: aggregateError } = await supabase
      .rpc('get_weekly_google_fit_aggregates', {
        p_user_id: userId,
        p_week_start_date: startDateStr
      });

    if (!aggregateError && aggregateData && aggregateData.length > 0) {
      const aggregate = aggregateData[0];
      const dailyBreakdown = aggregate.daily_breakdown || [];
      
      return {
        totalDistanceKm: parseFloat(aggregate.total_distance_km || '0'),
        totalSteps: aggregate.total_steps || 0,
        totalCaloriesBurned: parseFloat(aggregate.total_calories_burned || '0'),
        totalActiveMinutes: aggregate.total_active_minutes || 0,
        averageHeartRate: parseFloat(aggregate.average_heart_rate || '0'),
        days: dailyBreakdown.map((day: any) => ({
          date: day.date,
          distanceKm: parseFloat(day.distanceKm || '0'),
          steps: day.steps || 0,
          caloriesBurned: parseFloat(day.caloriesBurned || '0'),
          activeMinutes: day.activeMinutes || 0,
          heartRate: day.heartRate ? parseFloat(day.heartRate) : undefined
        }))
      };
    }

    // Fallback: Calculate from daily data if aggregates not available
    console.log('Weekly aggregates not available, calculating from daily data...');
    const endDate = endOfWeek(startDate, { weekStartsOn: 1 });
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Query Google Fit data for the week
    const { data: googleFitData, error } = await supabase
      .from('google_fit_data')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching weekly Google Fit data:', error);
      throw error;
    }

    // Initialize totals
    let totalDistanceKm = 0;
    let totalSteps = 0;
    let totalCaloriesBurned = 0;
    let totalActiveMinutes = 0;
    let totalHeartRate = 0;
    let heartRateCount = 0;

    // Create array for all 7 days of the week
    const days = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      // Find data for this specific date
      const dayData = googleFitData?.find(d => d.date === dateStr);
      
      const distanceKm = dayData ? (dayData.distance_meters || 0) / 1000 : 0;
      const steps = dayData?.steps || 0;
      const caloriesBurned = dayData?.calories_burned || 0;
      const activeMinutes = dayData?.active_minutes || 0;
      const heartRate = dayData?.heart_rate_avg;

      // Add to totals
      totalDistanceKm += distanceKm;
      totalSteps += steps;
      totalCaloriesBurned += caloriesBurned;
      totalActiveMinutes += activeMinutes;
      
      if (heartRate) {
        totalHeartRate += heartRate;
        heartRateCount++;
      }

      days.push({
        date: dateStr,
        distanceKm,
        steps,
        caloriesBurned,
        activeMinutes,
        heartRate
      });
    }

    // Store the calculated data in the aggregates table for future use
    try {
      await supabase.rpc('calculate_weekly_google_fit_aggregates', {
        p_user_id: userId,
        p_week_start_date: startDateStr
      });
    } catch (storeError) {
      console.warn('Failed to store weekly aggregates:', storeError);
    }

    return {
      totalDistanceKm,
      totalSteps,
      totalCaloriesBurned,
      totalActiveMinutes,
      averageHeartRate: heartRateCount > 0 ? totalHeartRate / heartRateCount : 0,
      days
    };
  } catch (error) {
    console.error('Error in getWeeklyGoogleFitData:', error);
    // Return empty data structure on error
    return {
      totalDistanceKm: 0,
      totalSteps: 0,
      totalCaloriesBurned: 0,
      totalActiveMinutes: 0,
      averageHeartRate: 0,
      days: []
    };
  }
}

/**
 * Get weekly mileage target from user profile
 * @param userId - User ID
 * @returns Weekly mileage target in kilometers
 */
export async function getWeeklyMileageTarget(userId: string): Promise<number> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('weekly_miles_target, fitness_level, goal_type')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      // Return default target based on fitness level
      return 30; // Default 30km per week
    }

    // If user has set a specific target, use it
    if (profile.weekly_miles_target) {
      return profile.weekly_miles_target;
    }

    // Otherwise, calculate based on fitness level and goal type
    const fitnessLevel = profile.fitness_level || 'intermediate';
    const goalType = profile.goal_type || 'general_fitness';

    // Default targets based on fitness level
    const targets = {
      beginner: 15,
      intermediate: 30,
      advanced: 50,
      elite: 80
    };

    // Adjust based on goal type
    const baseTarget = targets[fitnessLevel as keyof typeof targets] || 30;
    
    if (goalType === 'marathon') {
      return baseTarget * 1.5; // Marathon runners typically do more
    } else if (goalType === 'half_marathon') {
      return baseTarget * 1.2; // Half marathon runners do slightly more
    } else if (goalType === '5k_10k') {
      return baseTarget * 0.8; // Shorter distance runners do less
    }

    return baseTarget;
  } catch (error) {
    console.error('Error in getWeeklyMileageTarget:', error);
    return 30; // Default fallback
  }
}

/**
 * Refresh weekly aggregates for a specific user and week
 * This should be called when new Google Fit data is synced
 * @param userId - User ID
 * @param weekStart - Optional week start date (defaults to current week Monday)
 */
export async function refreshWeeklyAggregates(
  userId: string,
  weekStart?: Date
): Promise<void> {
  try {
    const startDate = weekStart ? startOfWeek(weekStart, { weekStartsOn: 1 }) : startOfWeek(new Date(), { weekStartsOn: 1 });
    const startDateStr = format(startDate, 'yyyy-MM-dd');

    await supabase.rpc('calculate_weekly_google_fit_aggregates', {
      p_user_id: userId,
      p_week_start_date: startDateStr
    });

    console.log(`Weekly aggregates refreshed for user ${userId}, week starting ${startDateStr}`);
  } catch (error) {
    console.error('Error refreshing weekly aggregates:', error);
  }
}

/**
 * Get all weekly aggregates for a user (for historical data)
 * @param userId - User ID
 * @param limit - Number of weeks to return (default: 12)
 * @returns Array of weekly aggregates
 */
export async function getWeeklyAggregatesHistory(
  userId: string,
  limit: number = 12
): Promise<WeeklyGoogleFitData[]> {
  try {
    const { data, error } = await supabase
      .from('weekly_google_fit_aggregates')
      .select('*')
      .eq('user_id', userId)
      .order('week_start_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching weekly aggregates history:', error);
      return [];
    }

    return data.map(aggregate => ({
      totalDistanceKm: parseFloat(aggregate.total_distance_km || '0'),
      totalSteps: aggregate.total_steps || 0,
      totalCaloriesBurned: parseFloat(aggregate.total_calories_burned || '0'),
      totalActiveMinutes: aggregate.total_active_minutes || 0,
      averageHeartRate: parseFloat(aggregate.average_heart_rate || '0'),
      days: (aggregate.daily_breakdown || []).map((day: any) => ({
        date: day.date,
        distanceKm: parseFloat(day.distanceKm || '0'),
        steps: day.steps || 0,
        caloriesBurned: parseFloat(day.caloriesBurned || '0'),
        activeMinutes: day.activeMinutes || 0,
        heartRate: day.heartRate ? parseFloat(day.heartRate) : undefined
      }))
    }));
  } catch (error) {
    console.error('Error in getWeeklyAggregatesHistory:', error);
    return [];
  }
}
