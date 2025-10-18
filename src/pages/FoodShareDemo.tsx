import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FoodShareDialog } from '@/components/FoodShareDialog';
import { FoodShareData } from '@/lib/image-overlay';
import { Share2, Loader2 } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function FoodShareDemo() {
  const { user } = useAuth();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodShareData | null>(null);
  const [foodLogs, setFoodLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customFood, setCustomFood] = useState<Partial<FoodShareData>>({
    foodName: 'My Custom Meal',
    calories: 500,
    protein: 25,
    carbs: 60,
    fat: 15,
    mealType: 'lunch',
  });

  // Load actual food logs from diary
  useEffect(() => {
    const loadFoodLogs = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('food_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('logged_date', { ascending: false })
          .limit(10);

        if (error) throw error;

        // Filter out logs without images
        const logsWithImages = (data || []).filter(log => log.image_url);
        setFoodLogs(logsWithImages);
      } catch (error) {
        console.error('Error loading food logs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFoodLogs();
  }, [user]);

  const handleOpenShare = (food: FoodShareData) => {
    setSelectedFood(food);
    setShareDialogOpen(true);
  };

  const handleOpenCustomShare = () => {
    const fullFood: FoodShareData = {
      foodName: customFood.foodName || 'My Meal',
      imageUrl: customFood.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
      calories: customFood.calories || 500,
      protein: customFood.protein || 25,
      carbs: customFood.carbs || 60,
      fat: customFood.fat || 15,
      date: new Date(),
      userName: 'You',
      mealType: (customFood.mealType as any) || 'lunch',
    };
    setSelectedFood(fullFood);
    setShareDialogOpen(true);
  };

  const convertFoodLogToShareData = (log: any): FoodShareData => {
    return {
      foodName: log.name || 'Food Log',
      imageUrl: log.image_url || '',
      calories: log.calories || 0,
      protein: log.protein_grams || 0,
      carbs: log.carbs_grams || 0,
      fat: log.fat_grams || 0,
      date: new Date(log.logged_date),
      userName: user?.user_metadata?.full_name || 'You',
      mealType: log.meal_type || 'lunch',
    };
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Share2 className="w-6 h-6" />
              <h1 className="text-3xl font-bold">Food Share Demo</h1>
            </div>
            <p className="text-muted-foreground">
              Share your actual logged meals with beautiful macro overlays. Click any meal from your diary to create a shareable image.
            </p>
          </div>

          {/* Your Food Logs Section */}
          <div className="space-y-6 mb-12">
            <div>
              <h2 className="text-xl font-semibold mb-4">Your Recent Meals</h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : foodLogs.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground mb-4">
                      No meals with photos in your diary yet. Log a meal with a photo first, or create a custom meal below.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      💡 Tip: Go to Meals page and upload a food photo to see it here!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {foodLogs.map((log) => (
                    <Card key={log.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                      {log.image_url && (
                        <img
                          src={log.image_url}
                          alt={log.name}
                          className="w-full h-48 object-cover"
                        />
                      )}
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-lg mb-2">{log.name || 'Food Log'}</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {new Date(log.logged_date).toLocaleDateString()} • {log.meal_type || 'meal'}
                        </p>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                          <div className="text-center">
                            <div className="text-lg font-bold text-orange-600">{log.calories}</div>
                            <div className="text-xs text-muted-foreground">cal</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-red-500">{log.protein_grams}g</div>
                            <div className="text-xs text-muted-foreground">protein</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-yellow-500">{log.carbs_grams}g</div>
                            <div className="text-xs text-muted-foreground">carbs</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-500">{log.fat_grams}g</div>
                            <div className="text-xs text-muted-foreground">fat</div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleOpenShare(convertFoodLogToShareData(log))}
                          className="w-full"
                          variant="outline"
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share This Meal
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Custom Food Section */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Create Custom Food Share</h2>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="foodName">Food Name</Label>
                      <Input
                        id="foodName"
                        value={customFood.foodName || ''}
                        onChange={(e) =>
                          setCustomFood({ ...customFood, foodName: e.target.value })
                        }
                        placeholder="e.g., Grilled Chicken Salad"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="imageUrl">Image URL</Label>
                      <Input
                        id="imageUrl"
                        value={customFood.imageUrl || ''}
                        onChange={(e) =>
                          setCustomFood({ ...customFood, imageUrl: e.target.value })
                        }
                        placeholder="https://..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="calories">Calories</Label>
                      <Input
                        id="calories"
                        type="number"
                        value={customFood.calories || 0}
                        onChange={(e) =>
                          setCustomFood({
                            ...customFood,
                            calories: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="protein">Protein (g)</Label>
                      <Input
                        id="protein"
                        type="number"
                        value={customFood.protein || 0}
                        onChange={(e) =>
                          setCustomFood({
                            ...customFood,
                            protein: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="carbs">Carbs (g)</Label>
                      <Input
                        id="carbs"
                        type="number"
                        value={customFood.carbs || 0}
                        onChange={(e) =>
                          setCustomFood({
                            ...customFood,
                            carbs: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fat">Fat (g)</Label>
                      <Input
                        id="fat"
                        type="number"
                        value={customFood.fat || 0}
                        onChange={(e) =>
                          setCustomFood({
                            ...customFood,
                            fat: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  <Button onClick={handleOpenCustomShare} className="w-full" size="lg">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Custom Food
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Info Box */}
          <Card className="mt-8 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-base">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                ✓ <strong>Your Meals:</strong> Shows recently logged meals with photos from your diary
              </p>
              <p>
                ✓ <strong>Share Options:</strong> Download, copy to clipboard, or use native share
              </p>
              <p>
                ✓ <strong>Formats:</strong> Instagram Story, Post, or Square
              </p>
              <p>
                ✓ <strong>Custom Meals:</strong> Test with any image URL and macro values
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                💡 Log more meals with photos in your diary to see them here!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share Dialog */}
      {selectedFood && (
        <FoodShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          foodData={selectedFood}
        />
      )}

      <BottomNav />
    </>
  );
}
