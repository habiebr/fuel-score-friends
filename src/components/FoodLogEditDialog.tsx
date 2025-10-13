import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calculator, Save, X, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FoodLog {
  id: string;
  food_name: string;
  meal_type: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  serving_size: string;
  logged_at: string;
}

interface FoodLogEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foodLog: FoodLog | null;
  onSave: () => void;
  onDelete?: () => void;
}

export function FoodLogEditDialog({ open, onOpenChange, foodLog, onSave, onDelete }: FoodLogEditDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [formData, setFormData] = useState({
    food_name: '',
    serving_size: '',
    meal_type: 'breakfast',
  });

  // Initialize form data when foodLog changes
  useEffect(() => {
    if (foodLog) {
      setFormData({
        food_name: foodLog.food_name,
        serving_size: foodLog.serving_size,
        meal_type: foodLog.meal_type,
      });
    }
  }, [foodLog]);

  const handleDelete = async () => {
    if (!user || !foodLog) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('food_logs')
        .delete()
        .eq('id', foodLog.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Food log deleted!',
        description: 'Your food entry has been successfully removed.',
      });

      onDelete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting food log:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete food log. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !foodLog) return;

    setLoading(true);
    try {
      // Recalculate nutrition using AI if food name or serving size changed
      let finalNutrition = {
        calories: foodLog.calories,
        protein_grams: foodLog.protein_grams,
        carbs_grams: foodLog.carbs_grams,
        fat_grams: foodLog.fat_grams,
      };

      if (formData.food_name !== foodLog.food_name || formData.serving_size !== foodLog.serving_size) {
        try {
          const { data, error } = await supabase.functions.invoke('nutrition-ai', {
            body: {
              food_name: formData.food_name,
              serving_size: formData.serving_size,
              meal_type: formData.meal_type
            }
          });

          if (!error && data) {
            finalNutrition = {
              calories: data.calories || 0,
              protein_grams: data.protein_grams || 0,
              carbs_grams: data.carbs_grams || 0,
              fat_grams: data.fat_grams || 0,
            };
          }
        } catch (aiError) {
          console.warn('AI nutrition calculation failed, keeping original values:', aiError);
          // Keep original values if AI fails
        }
      }

      const { error } = await supabase
        .from('food_logs')
        .update({
          food_name: formData.food_name,
          serving_size: formData.serving_size,
          meal_type: formData.meal_type,
          calories: finalNutrition.calories,
          protein_grams: finalNutrition.protein_grams,
          carbs_grams: finalNutrition.carbs_grams,
          fat_grams: finalNutrition.fat_grams,
        })
        .eq('id', foodLog.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Food log updated!',
        description: 'Your food entry has been successfully updated.',
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating food log:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update food log. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Edit Food Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Food Name */}
          <div className="space-y-2">
            <Label htmlFor="food_name">Food Name</Label>
            <Input
              id="food_name"
              value={formData.food_name}
              onChange={(e) => setFormData(prev => ({ ...prev, food_name: e.target.value }))}
              placeholder="Enter food name"
            />
            <div className="text-xs text-muted-foreground">
              Nutrition will be automatically recalculated when you save
            </div>
          </div>

          {/* Serving Size */}
          <div className="space-y-2">
            <Label htmlFor="serving_size">Serving Size</Label>
            <Input
              id="serving_size"
              value={formData.serving_size}
              onChange={(e) => setFormData(prev => ({ ...prev, serving_size: e.target.value }))}
              placeholder="e.g., 1 cup, 100g, 1 medium"
            />
          </div>

          {/* Meal Type */}
          <div className="space-y-2">
            <Label htmlFor="meal_type">Meal Type</Label>
            <Select
              value={formData.meal_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, meal_type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
                <SelectItem value="pre-run">Pre-run</SelectItem>
                <SelectItem value="post-run">Post-run</SelectItem>
                <SelectItem value="race-day">Race Day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Current Nutrition Display */}
          {foodLog && (
            <div className="space-y-2">
              <Label>Current Nutrition</Label>
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{foodLog.calories}</div>
                  <div className="text-xs text-muted-foreground">Calories</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{foodLog.protein_grams}g</div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">{foodLog.carbs_grams}g</div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{foodLog.fat_grams}g</div>
                  <div className="text-xs text-muted-foreground">Fat</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Nutrition will be automatically recalculated when you save changes
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            {onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
