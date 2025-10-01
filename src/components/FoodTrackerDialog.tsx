import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Upload, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface FoodTrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FoodTrackerDialog({ open, onOpenChange }: FoodTrackerDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [mealType, setMealType] = useState('lunch');
  const [nutritionData, setNutritionData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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

    setAnalyzing(true);
    setNutritionData(null);

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64Image = reader.result as string;
        
        const { data, error } = await supabase.functions.invoke('nutrition-ai', {
          body: { 
            type: 'food_photo',
            image: base64Image,
            mealType
          }
        });

        if (error) throw error;

        if (data.nutritionData) {
          setNutritionData(data.nutritionData);
          toast({
            title: "Food analyzed!",
            description: `Found: ${data.nutritionData.food_name}`,
          });
        }
      };
    } catch (error) {
      console.error('Error analyzing food:', error);
      toast({
        title: "Analysis failed",
        description: "Failed to analyze food. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
      event.target.value = '';
    }
  };

  const handleSaveLog = async () => {
    if (!user || !nutritionData) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('food_logs')
        .insert({
          user_id: user.id,
          meal_type: mealType,
          food_name: nutritionData.food_name,
          serving_size: nutritionData.serving_size,
          calories: nutritionData.calories,
          protein_grams: nutritionData.protein_grams,
          carbs_grams: nutritionData.carbs_grams,
          fat_grams: nutritionData.fat_grams,
        });

      if (error) throw error;

      toast({
        title: "Meal logged!",
        description: "Your nutrition data has been saved",
      });

      // Calculate nutrition score after logging food
      try {
        await supabase.functions.invoke('calculate-nutrition-score', {
          body: { date: format(new Date(), 'yyyy-MM-dd') }
        });
      } catch (scoreError) {
        console.error('Error calculating nutrition score:', scoreError);
      }
      
      // Reset and close
      setNutritionData(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving food log:', error);
      toast({
        title: "Save failed",
        description: "Failed to save meal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Track Your Meal</DialogTitle>
          <DialogDescription>Take a photo or upload an image of your food</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meal Type */}
          <div className="space-y-2">
            <Label htmlFor="meal-type">Meal Type</Label>
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger id="meal-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Upload Button */}
          <label htmlFor="food-image">
            <Button 
              variant="secondary" 
              className="w-full" 
              disabled={analyzing}
              asChild
            >
              <span>
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Take/Upload Photo
                  </>
                )}
              </span>
            </Button>
            <input
              id="food-image"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageUpload}
              disabled={analyzing}
            />
          </label>

          {/* Nutrition Results */}
          {nutritionData && (
            <div className="space-y-3 p-4 bg-success/10 border border-success/20 rounded-lg animate-fade-in">
              <div className="flex items-center gap-2 text-success">
                <Check className="h-4 w-4" />
                <span className="font-semibold">{nutritionData.food_name}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Serving: {nutritionData.serving_size}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-semibold text-foreground">{nutritionData.calories}</span>
                  <span className="text-muted-foreground"> cal</span>
                </div>
                <div>
                  <span className="font-semibold text-success">{nutritionData.protein_grams}g</span>
                  <span className="text-muted-foreground"> protein</span>
                </div>
                <div>
                  <span className="font-semibold text-warning">{nutritionData.carbs_grams}g</span>
                  <span className="text-muted-foreground"> carbs</span>
                </div>
                <div>
                  <span className="font-semibold text-info">{nutritionData.fat_grams}g</span>
                  <span className="text-muted-foreground"> fat</span>
                </div>
              </div>
              
              <Button 
                onClick={handleSaveLog}
                disabled={saving}
                className="w-full mt-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save to Log'
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
