import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface QuickMealLogProps {
  onMealLogged?: () => void;
  className?: string;
}

export function QuickMealLog({ onMealLogged, className = '' }: QuickMealLogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    food_name: '',
    calories: '',
    protein_grams: '',
    carbs_grams: '',
    fat_grams: '',
    meal_type: 'breakfast',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('food_logs').insert({
        user_id: user.id,
        food_name: formData.food_name,
        calories: parseFloat(formData.calories) || 0,
        protein_grams: parseFloat(formData.protein_grams) || 0,
        carbs_grams: parseFloat(formData.carbs_grams) || 0,
        fat_grams: parseFloat(formData.fat_grams) || 0,
        meal_type: formData.meal_type,
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: 'Meal logged!',
        description: `${formData.food_name} added successfully.`,
      });

      setOpen(false);
      setFormData({
        food_name: '',
        calories: '',
        protein_grams: '',
        carbs_grams: '',
        fat_grams: '',
        meal_type: 'breakfast',
      });

      onMealLogged?.();
    } catch (error) {
      console.error('Error logging meal:', error);
      toast({
        title: 'Error',
        description: 'Failed to log meal. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const quickMeals = [
    { name: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0 },
    { name: 'Energy Bar', calories: 200, protein: 10, carbs: 30, fat: 6 },
    { name: 'Greek Yogurt', calories: 150, protein: 15, carbs: 12, fat: 4 },
    { name: 'Oatmeal Bowl', calories: 300, protein: 10, carbs: 54, fat: 6 },
    { name: 'Protein Shake', calories: 250, protein: 25, carbs: 20, fat: 5 },
    { name: 'Chicken Breast (6oz)', calories: 280, protein: 53, carbs: 0, fat: 6 },
  ];

  const handleQuickAdd = (meal: typeof quickMeals[0]) => {
    setFormData({
      food_name: meal.name,
      calories: meal.calories.toString(),
      protein_grams: meal.protein.toString(),
      carbs_grams: meal.carbs.toString(),
      fat_grams: meal.fat.toString(),
      meal_type: formData.meal_type,
    });
  };

  return (
    <>
      {/* Floating Action Button with Tooltip */}
      <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-2">
        {/* Tooltip - shows on hover */}
        <div className="opacity-0 hover:opacity-100 transition-opacity duration-200 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-lg">
          Quick Meal Log
        </div>
        
        {/* FAB Button */}
        <button
          onClick={() => setOpen(true)}
          className={`${className} w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 text-white rounded-full shadow-xl hover:shadow-2xl transform hover:scale-110 transition-all duration-200 flex items-center justify-center group relative`}
          aria-label="Quick meal log"
        >
          <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform duration-200" />
          
          {/* Pulse animation ring */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 animate-ping opacity-20"></span>
        </button>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Meal Log</DialogTitle>
            <DialogDescription>
              Log your meal quickly to track your nutrition for the day.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quick Meal Templates */}
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
                Quick Add
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {quickMeals.map((meal) => (
                  <Button
                    key={meal.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAdd(meal)}
                    className="text-xs justify-start"
                  >
                    {meal.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Meal Type */}
            <div>
              <Label htmlFor="meal_type">Meal Type</Label>
              <Select
                value={formData.meal_type}
                onValueChange={(value) => setFormData({ ...formData, meal_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select meal type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="morning_snack">Mid-Morning Snack</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="afternoon_snack">Afternoon Snack</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="evening_snack">Evening Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Meal Name */}
            <div>
              <Label htmlFor="food_name">Meal Name *</Label>
              <Input
                id="food_name"
                value={formData.food_name}
                onChange={(e) => setFormData({ ...formData, food_name: e.target.value })}
                placeholder="e.g., Grilled chicken salad"
                required
              />
            </div>

            {/* Calories */}
            <div>
              <Label htmlFor="calories">Calories *</Label>
              <Input
                id="calories"
                type="number"
                value={formData.calories}
                onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                placeholder="250"
                required
                min="0"
              />
            </div>

            {/* Macros Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="protein_grams" className="text-sm">Protein (g)</Label>
                <Input
                  id="protein_grams"
                  type="number"
                  value={formData.protein_grams}
                  onChange={(e) => setFormData({ ...formData, protein_grams: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="carbs_grams" className="text-sm">Carbs (g)</Label>
                <Input
                  id="carbs_grams"
                  type="number"
                  value={formData.carbs_grams}
                  onChange={(e) => setFormData({ ...formData, carbs_grams: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="fat_grams" className="text-sm">Fat (g)</Label>
                <Input
                  id="fat_grams"
                  type="number"
                  value={formData.fat_grams}
                  onChange={(e) => setFormData({ ...formData, fat_grams: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.1"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Logging...
                  </>
                ) : (
                  'Log Meal'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

