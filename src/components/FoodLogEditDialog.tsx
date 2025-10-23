import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calculator, Save, X, Trash2, Sparkles, Edit3, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'manual' | 'ai'>('basic');
  const [formData, setFormData] = useState({
    food_name: '',
    serving_size: '',
    meal_type: 'breakfast',
  });
  const [manualNutrition, setManualNutrition] = useState({
    calories: 0,
    protein_grams: 0,
    carbs_grams: 0,
    fat_grams: 0,
  });
  const [aiNutrition, setAiNutrition] = useState({
    calories: 0,
    protein_grams: 0,
    carbs_grams: 0,
    fat_grams: 0,
  });
  const [aiCalculated, setAiCalculated] = useState(false);
  const [useManualNutrition, setUseManualNutrition] = useState(false);

  // Initialize form data when foodLog changes
  useEffect(() => {
    if (foodLog) {
      setFormData({
        food_name: foodLog.food_name,
        serving_size: foodLog.serving_size,
        meal_type: foodLog.meal_type,
      });
      setManualNutrition({
        calories: foodLog.calories,
        protein_grams: foodLog.protein_grams,
        carbs_grams: foodLog.carbs_grams,
        fat_grams: foodLog.fat_grams,
      });
      setAiNutrition({
        calories: foodLog.calories,
        protein_grams: foodLog.protein_grams,
        carbs_grams: foodLog.carbs_grams,
        fat_grams: foodLog.fat_grams,
      });
      setAiCalculated(false);
      setUseManualNutrition(false);
      setActiveTab('basic');
    }
  }, [foodLog]);

  const calculateAiNutrition = async () => {
    if (!formData.food_name.trim()) {
      toast({
        title: t('foodEdit.enterFoodName'),
        description: t('foodEdit.enterFoodNameDescription'),
        variant: 'destructive',
      });
      return;
    }

    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('nutrition-ai', {
        body: {
          food_name: formData.food_name,
          serving_size: formData.serving_size,
          meal_type: formData.meal_type,
          type: 'suggestion'
        }
      });

      if (error) throw error;

      if (data) {
        setAiNutrition({
          calories: data.calories || 0,
          protein_grams: data.protein_grams || 0,
          carbs_grams: data.carbs_grams || 0,
          fat_grams: data.fat_grams || 0,
        });
        setAiCalculated(true);
        toast({
          title: t('foodEdit.aiCalculationSuccess'),
          description: t('foodEdit.aiCalculationSuccessDescription'),
        });
      }
    } catch (error) {
      console.error('AI nutrition calculation failed:', error);
      toast({
        title: t('foodEdit.aiCalculationFailed'),
        description: t('foodEdit.aiCalculationFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setRecalculating(false);
    }
  };

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
      // Determine which nutrition values to use
      let finalNutrition;
      if (useManualNutrition) {
        finalNutrition = manualNutrition;
      } else if (aiCalculated) {
        finalNutrition = aiNutrition;
      } else {
        // Fallback to original values
        finalNutrition = {
          calories: foodLog.calories,
          protein_grams: foodLog.protein_grams,
          carbs_grams: foodLog.carbs_grams,
          fat_grams: foodLog.fat_grams,
        };
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
        title: t('foodEdit.updateSuccess'),
        description: t('foodEdit.updateSuccessDescription'),
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating food log:', error);
      toast({
        title: t('foodEdit.updateFailed'),
        description: t('foodEdit.updateFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {t('foodEdit.editFoodEntry')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'basic' | 'manual' | 'ai')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              {t('foodEdit.basic')}
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              {t('foodEdit.manual')}
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t('foodEdit.ai')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="food_name">{t('foodEdit.foodName')}</Label>
                <Input
                  id="food_name"
                  value={formData.food_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, food_name: e.target.value }))}
                  placeholder={t('foodEdit.enterFoodName')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serving_size">{t('foodEdit.servingSize')}</Label>
                <Input
                  id="serving_size"
                  value={formData.serving_size}
                  onChange={(e) => setFormData(prev => ({ ...prev, serving_size: e.target.value }))}
                  placeholder={t('foodEdit.servingSizePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meal_type">{t('foodEdit.mealType')}</Label>
                <Select
                  value={formData.meal_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, meal_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">{t('foodEdit.breakfast')}</SelectItem>
                    <SelectItem value="lunch">{t('foodEdit.lunch')}</SelectItem>
                    <SelectItem value="dinner">{t('foodEdit.dinner')}</SelectItem>
                    <SelectItem value="snack">{t('foodEdit.snack')}</SelectItem>
                    <SelectItem value="pre-run">{t('foodEdit.preRun')}</SelectItem>
                    <SelectItem value="post-run">{t('foodEdit.postRun')}</SelectItem>
                    <SelectItem value="race-day">{t('foodEdit.raceDay')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {foodLog && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t('foodEdit.currentNutrition')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{foodLog.calories}</div>
                        <div className="text-xs text-muted-foreground">{t('foodEdit.calories')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{foodLog.protein_grams}g</div>
                        <div className="text-xs text-muted-foreground">{t('foodEdit.protein')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{foodLog.carbs_grams}g</div>
                        <div className="text-xs text-muted-foreground">{t('foodEdit.carbs')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{foodLog.fat_grams}g</div>
                        <div className="text-xs text-muted-foreground">{t('foodEdit.fat')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('foodEdit.manualNutrition')}</CardTitle>
                <CardDescription>{t('foodEdit.manualNutritionDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual_calories">{t('foodEdit.calories')}</Label>
                    <Input
                      id="manual_calories"
                      type="number"
                      value={manualNutrition.calories}
                      onChange={(e) => setManualNutrition(prev => ({ ...prev, calories: Number(e.target.value) }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual_protein">{t('foodEdit.protein')} (g)</Label>
                    <Input
                      id="manual_protein"
                      type="number"
                      step="0.1"
                      value={manualNutrition.protein_grams}
                      onChange={(e) => setManualNutrition(prev => ({ ...prev, protein_grams: Number(e.target.value) }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual_carbs">{t('foodEdit.carbs')} (g)</Label>
                    <Input
                      id="manual_carbs"
                      type="number"
                      step="0.1"
                      value={manualNutrition.carbs_grams}
                      onChange={(e) => setManualNutrition(prev => ({ ...prev, carbs_grams: Number(e.target.value) }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual_fat">{t('foodEdit.fat')} (g)</Label>
                    <Input
                      id="manual_fat"
                      type="number"
                      step="0.1"
                      value={manualNutrition.fat_grams}
                      onChange={(e) => setManualNutrition(prev => ({ ...prev, fat_grams: Number(e.target.value) }))}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="use_manual"
                    checked={useManualNutrition}
                    onChange={(e) => setUseManualNutrition(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="use_manual" className="text-sm">
                    {t('foodEdit.useManualNutrition')}
                  </Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t('foodEdit.aiNutrition')}
                </CardTitle>
                <CardDescription>{t('foodEdit.aiNutritionDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={calculateAiNutrition}
                  disabled={recalculating || !formData.food_name.trim()}
                  className="w-full"
                >
                  {recalculating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {t('foodEdit.calculateAiNutrition')}
                </Button>

                {aiCalculated && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {t('foodEdit.aiCalculated')}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{aiNutrition.calories}</div>
                        <div className="text-xs text-muted-foreground">{t('foodEdit.calories')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{aiNutrition.protein_grams}g</div>
                        <div className="text-xs text-muted-foreground">{t('foodEdit.protein')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{aiNutrition.carbs_grams}g</div>
                        <div className="text-xs text-muted-foreground">{t('foodEdit.carbs')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{aiNutrition.fat_grams}g</div>
                        <div className="text-xs text-muted-foreground">{t('foodEdit.fat')}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            {t('foodEdit.cancel')}
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
              {t('foodEdit.delete')}
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
            {t('foodEdit.saveChanges')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}