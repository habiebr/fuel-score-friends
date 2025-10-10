import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, format } from 'date-fns';

interface ProfileGoal {
  goal_type?: string | null;
  goal_name?: string | null;
  fitness_goals?: string[] | null;
  target_date?: string | Date | null;
}

export function RaceGoalWidget() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const realtimeErrorLogged = useRef(false);
  const [goalLabel, setGoalLabel] = useState<string>('');
  const [raceDate, setRaceDate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!user || !session) {
      console.log('RaceGoalWidget: Skipping - no authenticated user');
      return;
    }
    const load = async () => {
      // Try selecting new columns; if missing (42703), retry with legacy columns
      let profile: ProfileGoal | null = null;
      const first = await supabase
        .from('profiles')
        .select('goal_type, goal_name, fitness_goals, target_date')
        .eq('user_id', user.id)
        .maybeSingle<ProfileGoal>();

      if ((first as any)?.error && String((first as any).error.code) === '42703') {
        const fallback = await supabase
          .from('profiles')
          .select('fitness_goals, target_date')
          .eq('user_id', user.id)
          .maybeSingle<ProfileGoal>();
        profile = (fallback as any)?.data || null;
      } else {
        profile = (first as any)?.data || null;
      }

      const formatLabel = (value?: string | null) => {
        if (!value) return '';
        return String(value)
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      };

      if (profile) {
        const label = profile.goal_name && String(profile.goal_name).trim().length > 0
          ? profile.goal_name
          : (Array.isArray(profile.fitness_goals) && profile.fitness_goals.length > 0
            ? String(profile.fitness_goals[0])
            : formatLabel(profile.goal_type));
        setGoalLabel(label || '');

        if (profile.target_date) {
          try {
            const iso = typeof profile.target_date === 'string'
              ? `${profile.target_date}T00:00:00`
              : new Date(profile.target_date).toISOString().split('T')[0] + 'T00:00:00';
            const d = new Date(iso);
            if (!isNaN(d.getTime())) setRaceDate(d);
          } catch {}
        }
      }
    };
    load();

    // Helper function to wait for session confirmation
    const waitForSessionConfirmation = async (): Promise<boolean> => {
      if (!user || !session) {
        console.log('RaceGoalWidget: No user or session available');
        return false;
      }

      try {
        // Test the session by making a simple authenticated request
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('RaceGoalWidget: Session validation failed:', error);
          return false;
        }

        if (!data.session || !data.session.access_token) {
          console.log('RaceGoalWidget: No valid session token found');
          return false;
        }

        // Test the session by making a simple database query
        const { error: testError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (testError) {
          console.error('RaceGoalWidget: Session test query failed:', testError);
          return false;
        }

        console.log('RaceGoalWidget: Session confirmed and validated');
        return true;
      } catch (error) {
        console.error('RaceGoalWidget: Session confirmation error:', error);
        return false;
      }
    };

    // Realtime updates when profile changes
    let isSubscribed = false;
    let channel: any = null;

    const setupRealtimeSubscription = async () => {
      // Wait for session confirmation before connecting
      const sessionConfirmed = await waitForSessionConfirmation();
      
      if (!sessionConfirmed) {
        console.log('RaceGoalWidget: Session not confirmed, skipping realtime subscription');
        return;
      }

      if (isSubscribed) {
        console.log('RaceGoalWidget: Already subscribed, skipping');
        return;
      }

      console.log('RaceGoalWidget: Setting up realtime subscription for user:', user.id);
      channel = supabase
        .channel('race-goal-widget')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, () => {
          load();
        })
        .subscribe((status) => {
          console.log('RaceGoalWidget realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('RaceGoalWidget: Successfully subscribed to realtime updates');
            isSubscribed = true;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (!realtimeErrorLogged.current) {
              console.warn('RaceGoalWidget: Realtime subscription failed with status:', status);
              realtimeErrorLogged.current = true;
            }
            isSubscribed = false;
            if (channel) {
              supabase.removeChannel(channel);
              channel = null;
            }
            // Don't treat this as a critical error - app can work without realtime
          }
        });
    };

    // Add a small delay to ensure session is fully established
    const timer = setTimeout(setupRealtimeSubscription, 1000);

    return () => {
      clearTimeout(timer);
      if (channel) {
        try { 
          console.log('RaceGoalWidget: Cleaning up realtime subscription');
          supabase.removeChannel(channel); 
          isSubscribed = false;
        } catch (error) {
          console.warn('RaceGoalWidget: Error removing realtime channel:', error);
        }
      }
    };
  }, [user, session]);

  useEffect(() => {
    if (!raceDate) return;
    const tick = () => {
      const now = new Date();
      const target = raceDate;
      if (target <= now) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(differenceInSeconds(target, now) / (24 * 60 * 60));
      const hours = differenceInHours(target, now) % 24;
      const minutes = differenceInMinutes(target, now) % 60;
      const seconds = differenceInSeconds(target, now) % 60;
      setCountdown({ days, hours, minutes, seconds });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [raceDate]);

  return (
    <Card className={`shadow-card mb-6 bg-gradient-to-br ${goalLabel ? 'from-primary/5 to-primary-glow/10 border-primary/20' : 'from-muted/5 to-muted/10 border-muted/20'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className={`h-4 w-4 ${goalLabel ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className={`font-medium text-sm ${goalLabel ? 'text-primary' : 'text-muted-foreground'}`}>
              {goalLabel || 'No goal set'}
            </div>
          </div>
          {countdown && raceDate ? (
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <Clock className="h-4 w-4" />
              <span>{countdown.days}d {countdown.hours}h {countdown.minutes}m</span>
            </div>
          ) : (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/goals')}
              className="text-primary hover:text-primary-glow"
            >
              {goalLabel ? 'Update' : 'Set Goal'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

