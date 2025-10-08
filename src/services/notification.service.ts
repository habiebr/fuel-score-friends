import { supabase } from '@/integrations/supabase/client';
import { format, addDays, isToday, isTomorrow } from 'date-fns';

interface TrainingNotification {
  id: string;
  user_id: string;
  type: 'pre_training' | 'post_training' | 'recovery';
  title: string;
  message: string;
  scheduled_for: string;
  training_date: string;
  activity_type: string;
  is_read: boolean;
  created_at: string;
}

interface PreTrainingRecommendation {
  activity_type: string;
  start_time: string;
  duration_minutes: number;
  intensity: string;
  carbs: number;
  protein: number;
  fat: number;
  calories: number;
  suggestions: string[];
  timing: string;
}

export class NotificationService {
  static async createPreTrainingNotification(
    userId: string,
    trainingDate: string,
    activity: {
      activity_type: string;
      start_time?: string;
      duration_minutes: number;
      intensity: string;
    }
  ): Promise<void> {
    const notificationDate = addDays(new Date(trainingDate), -1); // 1 day before
    
    const recommendation = this.generatePreTrainingRecommendation(activity);
    
    const notification: Omit<TrainingNotification, 'id' | 'created_at'> = {
      user_id: userId,
      type: 'pre_training',
      title: `Pre-Training Nutrition for ${activity.activity_type}`,
      message: `Tomorrow you have ${activity.activity_type} scheduled. Here's your nutrition plan: ${recommendation.carbs}g carbs, ${recommendation.protein}g protein, ${recommendation.calories} calories. Eat ${recommendation.timing}.`,
      scheduled_for: notificationDate.toISOString(),
      training_date: trainingDate,
      activity_type: activity.activity_type,
      is_read: false
    };

    await supabase
      .from('training_notifications' as any)
      .insert(notification as any);
  }

  static async createPostTrainingNotification(
    userId: string,
    trainingDate: string,
    activity: {
      activity_type: string;
      duration_minutes: number;
      intensity: string;
      calories_burned?: number;
    }
  ): Promise<void> {
    const recommendation = this.generatePostTrainingRecommendation(activity);
    
    const notification: Omit<TrainingNotification, 'id' | 'created_at'> = {
      user_id: userId,
      type: 'post_training',
      title: `Recovery Nutrition for ${activity.activity_type}`,
      message: `Great job on your ${activity.activity_type}! Here's your recovery plan: ${recommendation.carbs}g carbs, ${recommendation.protein}g protein, ${recommendation.calories} calories. Eat within ${recommendation.timing}.`,
      scheduled_for: new Date().toISOString(),
      training_date: trainingDate,
      activity_type: activity.activity_type,
      is_read: false
    };

    await supabase
      .from('training_notifications' as any)
      .insert(notification as any);
  }

  static async getNotifications(userId: string, limit: number = 10): Promise<TrainingNotification[]> {
    const { data, error } = await supabase
      .from('training_notifications' as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static async markAsRead(notificationId: string): Promise<void> {
    await supabase
      .from('training_notifications' as any)
      .update({ is_read: true })
      .eq('id', notificationId);
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await supabase
      .from('training_notifications' as any)
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  }

  static async deleteNotification(notificationId: string): Promise<void> {
    await supabase
      .from('training_notifications' as any)
      .delete()
      .eq('id', notificationId);
  }

  private static generatePreTrainingRecommendation(activity: any): PreTrainingRecommendation {
    const baseWeight = 70; // Default weight, should be fetched from profile
    const hoursBefore = 2; // Default 2 hours before
    
    const carbs = Math.round(baseWeight * 1.5); // 1.5g/kg body weight
    const protein = Math.round(baseWeight * 0.3); // 0.3g/kg body weight
    const fat = Math.round(baseWeight * 0.2); // 0.2g/kg body weight
    const calories = Math.round((carbs * 4) + (protein * 4) + (fat * 9));

    const suggestions = [
      'Banana with peanut butter',
      'Oatmeal with berries',
      'Toast with honey',
      'Greek yogurt with granola'
    ];

    return {
      activity_type: activity.activity_type,
      start_time: activity.start_time || 'morning',
      duration_minutes: activity.duration_minutes,
      intensity: activity.intensity,
      carbs,
      protein,
      fat,
      calories,
      suggestions,
      timing: `${hoursBefore} hours before training`
    };
  }

  private static generatePostTrainingRecommendation(activity: any): PreTrainingRecommendation {
    const baseWeight = 70; // Default weight, should be fetched from profile
    
    const carbs = Math.round(baseWeight * 1.0); // 1.0g/kg body weight
    const protein = Math.round(baseWeight * 0.3); // 0.3g/kg body weight
    const fat = Math.round(baseWeight * 0.1); // 0.1g/kg body weight
    const calories = Math.round((carbs * 4) + (protein * 4) + (fat * 9));

    const suggestions = [
      'Chocolate milk',
      'Protein smoothie',
      'Rice with chicken',
      'Greek yogurt with fruit'
    ];

    return {
      activity_type: activity.activity_type,
      start_time: 'now',
      duration_minutes: activity.duration_minutes,
      intensity: activity.intensity,
      carbs,
      protein,
      fat,
      calories,
      suggestions,
      timing: '30-60 minutes after training'
    };
  }
}
