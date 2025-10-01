import { useEffect, useState } from 'react';
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [goalLabel, setGoalLabel] = useState<string>('');
  const [raceDate, setRaceDate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
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

    // Realtime updates when profile changes
    const channel = supabase
      .channel('race-goal-widget')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, () => {
        load();
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [user]);

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

  if (!goalLabel) {
    return (
      <Card className="shadow-card mb-6 bg-gradient-to-br from-muted/5 to-muted/10 border-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm text-muted-foreground">Race Goal</span>
              </div>
              <div className="text-lg font-bold text-muted-foreground">No goal set</div>
              <div className="text-xs text-muted-foreground mt-1">Set your running goal to see countdown timer</div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/goals')}
              className="text-primary hover:text-primary-glow"
            >
              Set Goal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card mb-6 bg-gradient-to-br from-primary/5 to-primary-glow/10 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Race Goal</span>
            </div>
            <div className="text-lg font-bold text-primary">{goalLabel}</div>
            {raceDate && (
              <div className="text-xs text-muted-foreground mt-1">
                Target: {Math.max(0, Math.floor(differenceInDays(raceDate, new Date()) / 30))} months
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/goals')}
            className="text-primary hover:text-primary-glow"
          >
            Update
          </Button>
        </div>
        {countdown && raceDate && (
          <div className="pt-3 border-t border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Time until race:</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center bg-primary/10 rounded-lg p-2">
                <div className="text-xl font-bold text-primary">{countdown.days}</div>
                <div className="text-xs text-muted-foreground">Days</div>
              </div>
              <div className="text-center bg-primary/10 rounded-lg p-2">
                <div className="text-xl font-bold text-primary">{countdown.hours}</div>
                <div className="text-xs text-muted-foreground">Hours</div>
              </div>
              <div className="text-center bg-primary/10 rounded-lg p-2">
                <div className="text-xl font-bold text-primary">{countdown.minutes}</div>
                <div className="text-xs text-muted-foreground">Mins</div>
              </div>
              <div className="text-center bg-primary/10 rounded-lg p-2">
                <div className="text-xl font-bold text-primary">{countdown.seconds}</div>
                <div className="text-xs text-muted-foreground">Secs</div>
              </div>
            </div>
            <div className="text-xs text-center text-muted-foreground mt-2">
              Race date: {format(raceDate, 'MMM dd, yyyy')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


