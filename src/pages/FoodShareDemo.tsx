import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  // Load actual food logs from diary - NO FILTER, JUST ALL LOGS
  useEffect(() => {
    const loadFoodLogs = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        console.log('Loading food logs for user:', user.id);
        
        const { data, error } = await supabase
          .from('food_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('logged_date', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Query error:', error);
          throw error;
        }

        console.log('Food logs loaded:', data);
        setFoodLogs(data || []);
      } catch (error) {
        console.error('Error loading food logs:', error);
        setFoodLogs([]);
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

  const convertFoodLogToShareData = (log: any): FoodShareData => {
    return {
      foodName: log.name || 'Food Log',
      imageUrl: log.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
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
              <h1 className="text-3xl font-bold">Share Your Meal</h1>
            </div>
            <p className="text-muted-foreground">
              Create beautiful Instagram Reels with your food photos and macro data. Click any meal to share.
            </p>
          </div>

          {/* Your Food Logs Section */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Your Logged Meals</h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Loading your meals...</span>
                </div>
              ) : foodLogs.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground mb-4">
                      No meals logged yet. Log a meal with a photo first!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      💡 Go to the Meals page and upload a food photo to see it here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {foodLogs.map((log) => {
                    const hasImage = !!log.image_url;
                    return (
                      <Card key={log.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                        {hasImage && (
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
                              <div className="text-xs text-muted-foreground">P</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-yellow-500">{log.carbs_grams}g</div>
                              <div className="text-xs text-muted-foreground">C</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-500">{log.fat_grams}g</div>
                              <div className="text-xs text-muted-foreground">F</div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleOpenShare(convertFoodLogToShareData(log))}
                            className="w-full"
                            variant={hasImage ? "default" : "outline"}
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            {hasImage ? 'Share Meal' : 'Share (No Photo)'}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <Card className="mt-8 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-base">Share Format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                ✓ <strong>Instagram Reels Format:</strong> Full-screen 9:16 aspect ratio (1080×1920px)
              </p>
              <p>
                ✓ <strong>Clean Metrics:</strong> Just numbers, no circles - Strava-style design
              </p>
              <p>
                ✓ <strong>Share Options:</strong> Download, copy to clipboard, or use native share
              </p>
              <p>
                ✓ <strong>Multiple Formats:</strong> Choose Story, Post, or Square when sharing
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                💡 All your logged meals appear here - meals with photos get special formatting!
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
