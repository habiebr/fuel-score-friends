import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Utensils, 
  Clock, 
  Plus, 
  X, 
  Coffee, 
  Sun, 
  Moon, 
  Apple,
  Settings,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface MealPreferences {
  mealMode: 'flexi' | 'strict';
  strictMealPreferences: {
    breakfast?: {
      enabled: boolean;
      reason?: string;
      alternative?: string;
    };
    lunch?: {
      enabled: boolean;
      preferred_foods: string[];
      avoid_foods: string[];
      meal_time?: string;
    };
    dinner?: {
      enabled: boolean;
      preferred_foods: string[];
      avoid_foods: string[];
      meal_time?: string;
    };
    snack?: {
      enabled: boolean;
      preferred_foods: string[];
      avoid_foods: string[];
      meal_time?: string;
    };
  };
  mealTimePreferences: {
    breakfast_time?: string;
    lunch_time?: string;
    dinner_time?: string;
    snack_time?: string;
    flexible_timing: boolean;
  };
}

export function MealPreferencesForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<MealPreferences>({
    mealMode: 'flexi',
    strictMealPreferences: {
      breakfast: { enabled: true },
      lunch: { enabled: true, preferred_foods: [], avoid_foods: [] },
      dinner: { enabled: true, preferred_foods: [], avoid_foods: [] },
      snack: { enabled: false, preferred_foods: [], avoid_foods: [] }
    },
    mealTimePreferences: {
      flexible_timing: true
    }
  });

  const [newPreferredFood, setNewPreferredFood] = useState('');
  const [newAvoidFood, setNewAvoidFood] = useState('');
  const [activeMeal, setActiveMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('meal_mode, strict_meal_preferences, meal_time_preferences')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPreferences({
          mealMode: data.meal_mode || 'flexi',
          strictMealPreferences: data.strict_meal_preferences || {
            breakfast: { enabled: true },
            lunch: { enabled: true, preferred_foods: [], avoid_foods: [] },
            dinner: { enabled: true, preferred_foods: [], avoid_foods: [] },
            snack: { enabled: false, preferred_foods: [], avoid_foods: [] }
          },
          mealTimePreferences: data.meal_time_preferences || {
            flexible_timing: true
          }
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast({
        title: "Error loading preferences",
        description: "Could not load your meal preferences. Using defaults.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          meal_mode: preferences.mealMode,
          strict_meal_preferences: preferences.strictMealPreferences,
          meal_time_preferences: preferences.mealTimePreferences,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Preferences saved",
        description: "Your meal preferences have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error saving preferences",
        description: "Could not save your meal preferences. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const addPreferredFood = (meal: keyof typeof preferences.strictMealPreferences) => {
    if (!newPreferredFood.trim()) return;
    
    const currentMeal = preferences.strictMealPreferences[meal];
    if (currentMeal && Array.isArray(currentMeal.preferred_foods)) {
      setPreferences(prev => ({
        ...prev,
        strictMealPreferences: {
          ...prev.strictMealPreferences,
          [meal]: {
            ...currentMeal,
            preferred_foods: [...currentMeal.preferred_foods, newPreferredFood.trim()]
          }
        }
      }));
      setNewPreferredFood('');
    }
  };

  const removePreferredFood = (meal: keyof typeof preferences.strictMealPreferences, food: string) => {
    const currentMeal = preferences.strictMealPreferences[meal];
    if (currentMeal && Array.isArray(currentMeal.preferred_foods)) {
      setPreferences(prev => ({
        ...prev,
        strictMealPreferences: {
          ...prev.strictMealPreferences,
          [meal]: {
            ...currentMeal,
            preferred_foods: currentMeal.preferred_foods.filter(f => f !== food)
          }
        }
      }));
    }
  };

  const addAvoidFood = (meal: keyof typeof preferences.strictMealPreferences) => {
    if (!newAvoidFood.trim()) return;
    
    const currentMeal = preferences.strictMealPreferences[meal];
    if (currentMeal && Array.isArray(currentMeal.avoid_foods)) {
      setPreferences(prev => ({
        ...prev,
        strictMealPreferences: {
          ...prev.strictMealPreferences,
          [meal]: {
            ...currentMeal,
            avoid_foods: [...currentMeal.avoid_foods, newAvoidFood.trim()]
          }
        }
      }));
      setNewAvoidFood('');
    }
  };

  const removeAvoidFood = (meal: keyof typeof preferences.strictMealPreferences, food: string) => {
    const currentMeal = preferences.strictMealPreferences[meal];
    if (currentMeal && Array.isArray(currentMeal.avoid_foods)) {
      setPreferences(prev => ({
        ...prev,
        strictMealPreferences: {
          ...prev.strictMealPreferences,
          [meal]: {
            ...currentMeal,
            avoid_foods: currentMeal.avoid_foods.filter(f => f !== food)
          }
        }
      }));
    }
  };

  const toggleMealEnabled = (meal: keyof typeof preferences.strictMealPreferences) => {
    const currentMeal = preferences.strictMealPreferences[meal];
    if (currentMeal) {
      setPreferences(prev => ({
        ...prev,
        strictMealPreferences: {
          ...prev.strictMealPreferences,
          [meal]: {
            ...currentMeal,
            enabled: !currentMeal.enabled
          }
        }
      }));
    }
  };

  const setMealTime = (meal: keyof typeof preferences.strictMealPreferences, time: string) => {
    const currentMeal = preferences.strictMealPreferences[meal];
    if (currentMeal) {
      setPreferences(prev => ({
        ...prev,
        strictMealPreferences: {
          ...prev.strictMealPreferences,
          [meal]: {
            ...currentMeal,
            meal_time: time
          }
        }
      }));
    }
  };

  if (loading) {
    return (
      <Card className="premium-card">
        <CardContent className="p-6">
          <div className="animate-pulse text-muted-foreground">Loading meal preferences...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Meal Mode Selection */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Meal Planning Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Meal Planning Mode</Label>
              <p className="text-sm text-muted-foreground">
                Choose how flexible you want your meal suggestions to be
              </p>
            </div>
            <Select 
              value={preferences.mealMode} 
              onValueChange={(value: 'flexi' | 'strict') => 
                setPreferences(prev => ({ ...prev, mealMode: value }))
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flexi">Flexi Mode</SelectItem>
                <SelectItem value="strict">Strict Mode</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            {preferences.mealMode === 'flexi' ? (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            )}
            <div>
              <p className="font-medium">
                {preferences.mealMode === 'flexi' ? 'Flexi Mode' : 'Strict Mode'}
              </p>
              <p className="text-sm text-muted-foreground">
                {preferences.mealMode === 'flexi' 
                  ? 'AI will suggest flexible meal options with adjustable ratios. You can modify meal preferences anytime.'
                  : 'AI will strictly follow your fixed meal preferences, only suggesting foods you like and avoiding foods you dislike.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flexi Mode Info - Only show when Flexi Mode is selected */}
      {preferences.mealMode === 'flexi' && (
        <Card className="premium-card bg-gradient-to-br from-green-500/5 to-green-600/10 border-green-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Flexi Mode Active</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  You're using flexible meal planning! The AI will suggest adaptable meal options with standard ratios.
                </p>
                <div className="text-sm text-muted-foreground">
                  <p className="mb-1">• <strong>Flexible suggestions:</strong> AI can suggest any Indonesian foods</p>
                  <p className="mb-1">• <strong>Adjustable ratios:</strong> Standard meal distribution (25% breakfast, 35% lunch, 40% dinner)</p>
                  <p className="mb-1">• <strong>Easy changes:</strong> You can modify preferences anytime</p>
                  <p>• <strong>No restrictions:</strong> No strict food preferences to follow</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strict Mode Settings - Only show when Strict Mode is selected */}
      {preferences.mealMode === 'strict' && (
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Strict Meal Preferences
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure your exact meal preferences for strict meal planning
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Strict Mode Info */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-300">Strict Mode Active</p>
                <p className="text-sm text-muted-foreground">
                  The AI will now strictly follow your meal preferences. Configure your preferred foods, meal times, and which meals to include below.
                </p>
              </div>
            </div>
            {/* Meal Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => {
                const mealData = preferences.strictMealPreferences[meal];
                const icons = {
                  breakfast: Coffee,
                  lunch: Sun,
                  dinner: Moon,
                  snack: Apple
                };
                const Icon = icons[meal];
                
                return (
                  <Button
                    key={meal}
                    variant={activeMeal === meal ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveMeal(meal)}
                    className="flex items-center gap-2 capitalize"
                  >
                    <Icon className="h-4 w-4" />
                    {meal}
                    {mealData?.enabled === false && (
                      <X className="h-3 w-3 text-destructive" />
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Active Meal Settings */}
            {(() => {
              const mealData = preferences.strictMealPreferences[activeMeal];
              if (!mealData) return null;

              return (
                <div className="space-y-4">
                  {/* Meal Enable/Disable */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium capitalize">{activeMeal} Settings</Label>
                      <p className="text-sm text-muted-foreground">
                        {mealData.enabled 
                          ? `Enable ${activeMeal} suggestions` 
                          : `Disable ${activeMeal} suggestions`
                        }
                      </p>
                    </div>
                    <Switch
                      checked={mealData.enabled}
                      onCheckedChange={() => toggleMealEnabled(activeMeal)}
                    />
                  </div>

                  {mealData.enabled && (
                    <>
                      {/* Meal Time */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Preferred {activeMeal} time
                        </Label>
                        <Input
                          type="time"
                          value={mealData.meal_time || ''}
                          onChange={(e) => setMealTime(activeMeal, e.target.value)}
                          placeholder="Select time"
                        />
                      </div>

                      {/* Preferred Foods */}
                      <div className="space-y-2">
                        <Label>Preferred Foods</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add preferred food..."
                            value={newPreferredFood}
                            onChange={(e) => setNewPreferredFood(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addPreferredFood(activeMeal)}
                          />
                          <Button 
                            size="sm" 
                            onClick={() => addPreferredFood(activeMeal)}
                            disabled={!newPreferredFood.trim()}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {mealData.preferred_foods?.map((food, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                              {food}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0 hover:bg-destructive/10"
                                onClick={() => removePreferredFood(activeMeal, food)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Avoid Foods */}
                      <div className="space-y-2">
                        <Label>Foods to Avoid</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add food to avoid..."
                            value={newAvoidFood}
                            onChange={(e) => setNewAvoidFood(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addAvoidFood(activeMeal)}
                          />
                          <Button 
                            size="sm" 
                            onClick={() => addAvoidFood(activeMeal)}
                            disabled={!newAvoidFood.trim()}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {mealData.avoid_foods?.map((food, index) => (
                            <Badge key={index} variant="destructive" className="flex items-center gap-1">
                              {food}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0 hover:bg-destructive/20"
                                onClick={() => removeAvoidFood(activeMeal, food)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {!mealData.enabled && activeMeal === 'breakfast' && (
                    <div className="space-y-2">
                      <Label>Reason for skipping breakfast</Label>
                      <Textarea
                        placeholder="e.g., Intermittent fasting, not hungry in the morning..."
                        value={mealData.reason || ''}
                        onChange={(e) => {
                          const currentMeal = preferences.strictMealPreferences[activeMeal];
                          if (currentMeal) {
                            setPreferences(prev => ({
                              ...prev,
                              strictMealPreferences: {
                                ...prev.strictMealPreferences,
                                [activeMeal]: {
                                  ...currentMeal,
                                  reason: e.target.value
                                }
                              }
                            }));
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={savePreferences} 
          disabled={saving}
          className="premium-button"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
