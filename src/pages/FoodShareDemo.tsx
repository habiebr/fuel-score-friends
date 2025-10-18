import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FoodShareDialog } from '@/components/FoodShareDialog';
import { FoodShareData } from '@/lib/image-overlay';
import { Share2 } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';

const SAMPLE_FOODS: FoodShareData[] = [
  {
    foodName: 'Post-Run Açai Bowl',
    imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed1d4f20?w=800&q=80',
    calories: 487,
    protein: 18,
    carbs: 62,
    fat: 14,
    date: new Date(),
    userName: 'Alex Runner',
    mealType: 'breakfast',
    trainingInfo: 'Easy 10K run',
  },
  {
    foodName: 'Grilled Salmon & Quinoa',
    imageUrl: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
    calories: 625,
    protein: 42,
    carbs: 48,
    fat: 22,
    date: new Date(),
    userName: 'Alex Runner',
    mealType: 'lunch',
  },
  {
    foodName: 'Recovery Protein Smoothie',
    imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed1d4f20?w=800&q=80',
    calories: 350,
    protein: 28,
    carbs: 42,
    fat: 6,
    date: new Date(),
    userName: 'Alex Runner',
    mealType: 'snack',
  },
  {
    foodName: 'Pasta Carbonara',
    imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221fcf4f?w=800&q=80',
    calories: 580,
    protein: 24,
    carbs: 68,
    fat: 20,
    date: new Date(),
    userName: 'Alex Runner',
    mealType: 'dinner',
  },
];

export default function FoodShareDemo() {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodShareData | null>(null);
  const [customFood, setCustomFood] = useState<Partial<FoodShareData>>({
    foodName: 'My Custom Meal',
    calories: 500,
    protein: 25,
    carbs: 60,
    fat: 15,
    mealType: 'lunch',
  });

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
              Test the Strava-style food image sharing feature. Click any meal to open the share dialog.
            </p>
          </div>

          {/* Sample Foods Section */}
          <div className="space-y-6 mb-12">
            <div>
              <h2 className="text-xl font-semibold mb-4">Sample Meals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SAMPLE_FOODS.map((food) => (
                  <Card key={food.foodName} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                    <img
                      src={food.imageUrl}
                      alt={food.foodName}
                      className="w-full h-48 object-cover"
                    />
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2">{food.foodName}</h3>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">{food.calories}</div>
                          <div className="text-xs text-muted-foreground">cal</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-red-500">{food.protein}g</div>
                          <div className="text-xs text-muted-foreground">protein</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-yellow-500">{food.carbs}g</div>
                          <div className="text-xs text-muted-foreground">carbs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-500">{food.fat}g</div>
                          <div className="text-xs text-muted-foreground">fat</div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleOpenShare(food)}
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
                ✓ <strong>Preview:</strong> Real-time preview of your shareable image with adjustable theme
              </p>
              <p>
                ✓ <strong>Format Selection:</strong> Choose between Instagram Story, Post, or Square formats
              </p>
              <p>
                ✓ <strong>Download:</strong> Save high-resolution images optimized for social media
              </p>
              <p>
                ✓ <strong>Copy & Paste:</strong> Copy directly to clipboard for instant sharing
              </p>
              <p>
                ✓ <strong>Native Sharing:</strong> Use device-native share sheet on mobile
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                💡 This demo is not integrated yet - ready for testing and iteration!
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
