import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Scale, Ruler, Calendar, Activity, Target } from 'lucide-react';

export function BodyMetricsForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metrics, setMetrics] = useState({
    weight: '',
    height: '',
    age: '',
    activityLevel: 'moderate',
    fitnessGoal: 'maintain_weight'
  });

  useEffect(() => {
    if (user) {
      loadMetrics();
    }
  }, [user]);

  const loadMetrics = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('weight, height, age, activity_level, fitness_goals')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setMetrics({
          weight: data.weight?.toString() || '',
          height: data.height?.toString() || '',
          age: data.age?.toString() || '',
          activityLevel: data.activity_level || 'moderate',
          fitnessGoal: data.fitness_goals?.[0] || 'maintain_weight'
        });
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBMR = () => {
    const w = parseFloat(metrics.weight);
    const h = parseFloat(metrics.height);
    const a = parseFloat(metrics.age);
    
    if (!w || !h || !a) return null;
    
    // Mifflin-St Jeor Equation (for males, adjust if needed)
    return Math.round(10 * w + 6.25 * h - 5 * a + 5);
  };

  const calculateTDEE = () => {
    const bmr = calculateBMR();
    if (!bmr) return null;

    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    const multiplier = activityMultipliers[metrics.activityLevel] || 1.55;
    return Math.round(bmr * multiplier);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          weight: parseInt(metrics.weight) || null,
          height: parseInt(metrics.height) || null,
          age: parseInt(metrics.age) || null,
          activity_level: metrics.activityLevel,
          fitness_goals: [metrics.fitnessGoal]
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Metrics saved!",
        description: "Your body metrics have been updated",
      });
    } catch (error) {
      console.error('Error saving metrics:', error);
      toast({
        title: "Save failed",
        description: "Failed to save body metrics",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const bmr = calculateBMR();
  const tdee = calculateTDEE();

  if (loading) {
    return (
      <Card className="premium-card">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Body Metrics
        </CardTitle>
        <CardDescription>
          Track your body metrics for personalized meal planning
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics Input Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weight" className="flex items-center gap-2">
              <Scale className="h-3 w-3" />
              Weight (kg)
            </Label>
            <Input
              id="weight"
              type="number"
              value={metrics.weight}
              onChange={(e) => setMetrics({ ...metrics, weight: e.target.value })}
              placeholder="70"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height" className="flex items-center gap-2">
              <Ruler className="h-3 w-3" />
              Height (cm)
            </Label>
            <Input
              id="height"
              type="number"
              value={metrics.height}
              onChange={(e) => setMetrics({ ...metrics, height: e.target.value })}
              placeholder="170"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="age" className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Age (years)
            </Label>
            <Input
              id="age"
              type="number"
              value={metrics.age}
              onChange={(e) => setMetrics({ ...metrics, age: e.target.value })}
              placeholder="30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity" className="flex items-center gap-2">
              <Activity className="h-3 w-3" />
              Activity Level
            </Label>
            <Select value={metrics.activityLevel} onValueChange={(value) => setMetrics({ ...metrics, activityLevel: value })}>
              <SelectTrigger id="activity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary (little/no exercise)</SelectItem>
                <SelectItem value="light">Light (1-3 days/week)</SelectItem>
                <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                <SelectItem value="active">Active (6-7 days/week)</SelectItem>
                <SelectItem value="very_active">Very Active (2x/day)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal" className="flex items-center gap-2">
            <Target className="h-3 w-3" />
            Fitness Goal
          </Label>
          <Select value={metrics.fitnessGoal} onValueChange={(value) => setMetrics({ ...metrics, fitnessGoal: value })}>
            <SelectTrigger id="goal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lose_weight">Lose Weight</SelectItem>
              <SelectItem value="maintain_weight">Maintain Weight</SelectItem>
              <SelectItem value="gain_muscle">Gain Muscle</SelectItem>
              <SelectItem value="improve_endurance">Improve Endurance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Calculated Metrics */}
        {bmr && tdee && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Calculated Daily Needs
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">BMR (Base)</div>
                <div className="text-xl font-bold text-primary">{bmr} kcal</div>
              </div>
              <div>
                <div className="text-muted-foreground">TDEE (Total)</div>
                <div className="text-xl font-bold text-primary">{tdee} kcal</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              AI will use these metrics + your activity data to generate personalized meal plans
            </p>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || !metrics.weight || !metrics.height || !metrics.age}
          className="w-full premium-button"
        >
          {saving ? 'Saving...' : 'Save Body Metrics'}
        </Button>
      </CardContent>
    </Card>
  );
}
