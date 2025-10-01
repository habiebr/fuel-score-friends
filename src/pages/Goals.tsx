import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Target, Upload, Calendar, Zap, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function Goals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [raceGoal, setRaceGoal] = useState('');
  const [targetMonths, setTargetMonths] = useState('');
  const [weeklyRuns, setWeeklyRuns] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadExistingGoals();
    }
  }, [user]);

  const loadExistingGoals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('fitness_goals, activity_level')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        if (data.fitness_goals && data.fitness_goals.length > 0) {
          setRaceGoal(data.fitness_goals[0]);
        }
        if (data.activity_level && data.activity_level.includes('runs_per_week')) {
          const runs = data.activity_level.split('_')[0];
          setWeeklyRuns(runs);
        }
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setParsing(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64Image = reader.result as string;
        
        const { data, error } = await supabase.functions.invoke('parse-training-plan', {
          body: { image: base64Image }
        });

        if (error) throw error;

        toast({
          title: "Training plan parsed!",
          description: data.message || "Your training schedule has been imported",
        });

        // Optionally set the parsed data
        if (data.weeklyRuns) setWeeklyRuns(data.weeklyRuns.toString());
      };
    } catch (error) {
      console.error('Error parsing training plan:', error);
      toast({
        title: "Parsing failed",
        description: "Failed to parse training plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
      event.target.value = '';
    }
  };

  const handleSaveGoals = async () => {
    if (!user) return;

    setUploading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          fitness_goals: [raceGoal],
          activity_level: weeklyRuns ? `${weeklyRuns}_runs_per_week` : 'moderate'
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Goals saved!",
        description: "Your training goals have been updated",
      });
    } catch (error) {
      console.error('Error saving goals:', error);
      toast({
        title: "Save failed",
        description: "Failed to save goals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-background flex items-center justify-center pb-20">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-primary rounded-full"></div>
          </div>
        </div>
        <BottomNav />
        <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      </>
    );
  }

  return (
    <>
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-7xl mx-auto p-4">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Training Goals</h1>
            <p className="text-muted-foreground text-sm">Set your race goals and training schedule</p>
            {raceGoal && (
              <div className="flex items-center gap-2 mt-2 text-success text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>Goal saved: {raceGoal.replace('_', ' ').toUpperCase()}</span>
              </div>
            )}
          </div>

          {/* Race Goal */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Race Goal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="race-type">Race Type</Label>
                <Select value={raceGoal} onValueChange={setRaceGoal}>
                  <SelectTrigger id="race-type">
                    <SelectValue placeholder="Select race distance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5k">5K</SelectItem>
                    <SelectItem value="10k">10K</SelectItem>
                    <SelectItem value="half_marathon">Half Marathon (HM)</SelectItem>
                    <SelectItem value="full_marathon">Full Marathon (FM)</SelectItem>
                    <SelectItem value="ultra">Ultra Marathon</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-months">Target Timeline (months)</Label>
                <Input
                  id="target-months"
                  type="number"
                  min="1"
                  max="24"
                  value={targetMonths}
                  onChange={(e) => setTargetMonths(e.target.value)}
                  placeholder="e.g., 6 months"
                />
              </div>
            </CardContent>
          </Card>

          {/* Training Schedule */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Training Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weekly-runs">Runs per week</Label>
                <Input
                  id="weekly-runs"
                  type="number"
                  min="1"
                  max="7"
                  value={weeklyRuns}
                  onChange={(e) => setWeeklyRuns(e.target.value)}
                  placeholder="e.g., 3-5 runs"
                />
              </div>

              {/* Upload Training Plan */}
              <div className="space-y-2">
                <Label>Upload Training Plan Image</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Take a photo of your training schedule and we'll parse it with AI
                </p>
                <label htmlFor="plan-upload">
                  <Button 
                    variant="secondary" 
                    className="w-full" 
                    disabled={parsing}
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {parsing ? 'Parsing...' : 'Upload Training Plan'}
                    </span>
                  </Button>
                  <input
                    id="plan-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={parsing}
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          {/* AI Nutrition Insights */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                AI Nutrition Coach
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Based on your training data, AI will automatically suggest optimal nutrition timing and amounts
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/')}
              >
                View Nutrition Insights
              </Button>
            </CardContent>
          </Card>

          <Button 
            onClick={handleSaveGoals}
            disabled={uploading || !raceGoal || !targetMonths}
            className="w-full"
          >
            Save Goals
          </Button>
        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
