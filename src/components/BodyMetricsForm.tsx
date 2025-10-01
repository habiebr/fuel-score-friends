import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Scale, Ruler, Calendar, Activity } from 'lucide-react';

export function BodyMetricsForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [metrics, setMetrics] = useState({
    weight: '',
    height: '',
    age: ''
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
        .select('weight, height, age')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setMetrics({
          weight: data.weight?.toString() || '',
          height: data.height?.toString() || '',
          age: data.age?.toString() || ''
        });

        // Enter view mode if all metrics are already provided
        const hasAll = !!(data.weight && data.height && data.age);
        setIsEditing(!hasAll);
      } else {
        setIsEditing(true);
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

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          weight: parseInt(metrics.weight) || null,
          height: parseInt(metrics.height) || null,
          age: parseInt(metrics.age) || null
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Metrics saved!",
        description: "Your body metrics have been updated",
      });

      // Return to view mode after successful save if all fields are present
      if (metrics.weight && metrics.height && metrics.age) {
        setIsEditing(false);
      }
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
        <div className="flex items-center justify-between">
          <CardDescription>
          Track your body metrics for personalized meal planning
          </CardDescription>
          {!isEditing && (
            <Button variant="ghost" onClick={() => setIsEditing(true)}>
              Change
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isEditing ? (
          <>
            {/* Metrics Input Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  min="0"
                  max="300"
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
                  min="0"
                  max="300"
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
                  min="0"
                  max="150"
                />
              </div>
            </div>

            {/* Calculated BMR */}
            {bmr && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Basal Metabolic Rate (BMR)
                </h4>
                <div className="text-2xl font-bold text-primary">{bmr} kcal/day</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Your body needs this many calories at rest. Activity level from your exercise plan will determine total daily needs.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !metrics.weight || !metrics.height || !metrics.age}
                className="w-full premium-button"
              >
                {saving ? 'Saving...' : 'Save Body Metrics'}
              </Button>
              {!loading && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                  <Scale className="h-3 w-3" /> Weight
                </div>
                <div className="text-xl font-semibold">{metrics.weight} kg</div>
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                  <Ruler className="h-3 w-3" /> Height
                </div>
                <div className="text-xl font-semibold">{metrics.height} cm</div>
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Age
                </div>
                <div className="text-xl font-semibold">{metrics.age} yrs</div>
              </div>
            </div>

            {bmr && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Basal Metabolic Rate (BMR)
                </h4>
                <div className="text-2xl font-bold text-primary">{bmr} kcal/day</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Your body needs this many calories at rest. Activity level from your exercise plan will determine total daily needs.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
