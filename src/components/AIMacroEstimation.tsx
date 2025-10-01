import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface MacroEstimation {
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  explanation: string;
}

export function AIMacroEstimation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [estimation, setEstimation] = useState<MacroEstimation | null>(null);

  const generateEstimation = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('estimate-macros', {
        body: {}
      });

      if (error) throw error;

      if (data.estimation) {
        setEstimation(data.estimation);
        toast({
          title: 'Macros estimated!',
          description: 'Your personalized nutrition plan has been generated',
        });
      }
    } catch (error) {
      console.error('Error generating macro estimation:', error);
      toast({
        title: 'Estimation failed',
        description: 'Failed to generate macro estimation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Macro Estimation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Get personalized macronutrient recommendations based on your activity data and goals
        </p>

        {!estimation ? (
          <Button 
            onClick={generateEstimation} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing your data...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Generate Estimation
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Daily Target */}
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="text-center mb-3">
                <div className="text-3xl font-bold text-primary">{estimation.dailyCalories}</div>
                <div className="text-sm text-muted-foreground">Daily Calories</div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-3 bg-success/10 rounded-lg">
                  <div className="text-xl font-bold text-success">{estimation.protein}g</div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </div>
                <div className="text-center p-3 bg-warning/10 rounded-lg">
                  <div className="text-xl font-bold text-warning">{estimation.carbs}g</div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </div>
                <div className="text-center p-3 bg-info/10 rounded-lg">
                  <div className="text-xl font-bold text-info">{estimation.fat}g</div>
                  <div className="text-xs text-muted-foreground">Fat</div>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
              <div className="font-semibold text-foreground mb-1">Why these numbers?</div>
              {estimation.explanation}
            </div>

            <Button 
              onClick={generateEstimation} 
              variant="outline"
              className="w-full"
            >
              Regenerate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
