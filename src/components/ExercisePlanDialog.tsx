import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Play, Pause, Dumbbell, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ExercisePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DayPlan {
  day: string;
  activity: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
  duration: number;
  estimatedCalories: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function ExercisePlanDialog({ open, onOpenChange }: ExercisePlanDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [weekPlan, setWeekPlan] = useState<DayPlan[]>(
    DAYS.map((day) => ({
      day,
      activity: 'rest',
      duration: 0,
      estimatedCalories: 0,
    }))
  );

  const calculateCalories = (activity: string, duration: number): number => {
    // Rough calorie estimates per minute
    const caloriesPerMinute: { [key: string]: number } = {
      rest: 0,
      run: 10,
      strength: 6,
      cardio: 8,
      other: 7,
    };
    return Math.round((caloriesPerMinute[activity] || 0) * duration);
  };

  const updateDayPlan = (index: number, field: keyof DayPlan, value: any) => {
    setWeekPlan((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Recalculate calories if activity or duration changes
      if (field === 'activity' || field === 'duration') {
        updated[index].estimatedCalories = calculateCalories(
          field === 'activity' ? value : updated[index].activity,
          field === 'duration' ? Number(value) : updated[index].duration
        );
      }
      
      return updated;
    });
  };

  const handleSavePlan = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Save exercise plan to profiles or create a new table
      const { error } = await supabase
        .from('profiles')
        .update({
          activity_level: JSON.stringify(weekPlan)
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Exercise plan saved!',
        description: 'Your weekly training schedule has been created',
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving exercise plan:', error);
      toast({
        title: 'Save failed',
        description: 'Failed to save exercise plan. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const totalWeeklyCalories = weekPlan.reduce((sum, day) => sum + day.estimatedCalories, 0);
  const activeDays = weekPlan.filter((day) => day.activity !== 'rest').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Create Exercise Plan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Weekly Summary */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div>
              <div className="text-2xl font-bold text-primary">{activeDays}</div>
              <div className="text-sm text-muted-foreground">Active Days</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{totalWeeklyCalories}</div>
              <div className="text-sm text-muted-foreground">Weekly Calories</div>
            </div>
          </div>

          {/* Day Plans */}
          <div className="space-y-3">
            {weekPlan.map((dayPlan, index) => (
              <div
                key={dayPlan.day}
                className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  {dayPlan.activity === 'rest' ? (
                    <Pause className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Play className="h-4 w-4 text-primary" />
                  )}
                  <div className="font-semibold text-sm flex-1">{dayPlan.day}</div>
                  {dayPlan.estimatedCalories > 0 && (
                    <div className="text-xs text-primary font-medium">
                      ~{dayPlan.estimatedCalories} cal
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Activity</Label>
                    <Select
                      value={dayPlan.activity}
                      onValueChange={(value) => updateDayPlan(index, 'activity', value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rest">Rest Day</SelectItem>
                        <SelectItem value="run">Running</SelectItem>
                        <SelectItem value="strength">Strength Training</SelectItem>
                        <SelectItem value="cardio">Cardio</SelectItem>
                        <SelectItem value="other">Other Exercise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {dayPlan.activity !== 'rest' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Duration (minutes)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="300"
                        value={dayPlan.duration || ''}
                        onChange={(e) => updateDayPlan(index, 'duration', e.target.value)}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <Button onClick={handleSavePlan} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Exercise Plan
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
