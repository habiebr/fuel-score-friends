import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Camera, Upload, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface FoodTrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProcessStage = 'idle' | 'uploading' | 'analyzing' | 'saving' | 'complete';

export function FoodTrackerDialog({ open, onOpenChange }: FoodTrackerDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stage, setStage] = useState<ProcessStage>('idle');
  const [progress, setProgress] = useState(0);
  const [mealType, setMealType] = useState('lunch');
  const [nutritionData, setNutritionData] = useState<any>(null);

  const getStageMessage = (currentStage: ProcessStage) => {
    switch (currentStage) {
      case 'uploading': return 'Uploading image...';
      case 'analyzing': return 'Analyzing food with AI...';
      case 'saving': return 'Saving to your log...';
      case 'complete': return 'Complete!';
      default: return '';
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

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setStage('uploading');
    setProgress(10);
    setNutritionData(null);

    let retryCount = 0;
    const maxRetries = 2;

    const attemptUpload = async (): Promise<void> => {
      try {
        setProgress(30);
        
        // Upload original file to Supabase Storage with timeout
        setProgress(40);
        const userId = user?.id || 'anonymous';
        const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const bucket = supabase.storage.from('food-photos');
        
        // Upload with timeout
        const uploadPromise = bucket.upload(path, file, { upsert: true, contentType: file.type });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout - please check your internet connection')), 30000)
        );
        
        const uploadRes = await Promise.race([uploadPromise, timeoutPromise]) as any;
        if (uploadRes.error) throw uploadRes.error;
        
        const signed = await bucket.createSignedUrl(path, 600); // 10 minutes
        if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error('Failed to create signed URL');

        setStage('analyzing');
        setProgress(60);
        
        // Call edge function with timeout and retry logic
        const session = (await supabase.auth.getSession()).data.session;
        
        const invokePromise = supabase.functions.invoke('nutrition-ai', {
          body: { 
            type: 'food_photo',
            image: signed.data.signedUrl,
            mealType
          },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        });
        
        const edgeFunctionTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Analysis timeout - AI is taking too long to respond')), 60000)
        );
        
        const { data, error } = await Promise.race([invokePromise, edgeFunctionTimeout]) as any;

        if (error) {
          console.error('Nutrition AI error:', error);
          
          // Check for network errors that can be retried
          const isNetworkError = error.message?.includes('Failed to send') || 
                                 error.message?.includes('network') ||
                                 error.message?.includes('fetch') ||
                                 error.message?.includes('NetworkError');
          
          if (isNetworkError && retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying... Attempt ${retryCount + 1} of ${maxRetries + 1}`);
            toast({
              title: "Connection issue",
              description: `Retrying... (${retryCount}/${maxRetries})`,
            });
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            return attemptUpload();
          }
          
          throw new Error(error.message || 'Failed to analyze food');
        }

        setProgress(90);

        if (data?.nutritionData) {
          setNutritionData(data.nutritionData);
          setStage('complete');
          setProgress(100);
          toast({
            title: "Food analyzed!",
            description: `Found: ${data.nutritionData.food_name}`,
          });
        } else {
          throw new Error('No nutrition data received from AI');
        }
      } catch (error) {
        console.error('Error analyzing food:', error);
        
        // More specific error messages
        let errorTitle = "Analysis failed";
        let errorMessage = "Unknown error occurred";
        
        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            errorTitle = "Request timed out";
            errorMessage = "The request took too long. Please check your internet connection and try again.";
          } else if (error.message.includes('Failed to send') || error.message.includes('NetworkError')) {
            errorTitle = "Connection error";
            errorMessage = "Unable to reach the server. Please check your internet connection and try again.";
          } else if (error.message.includes('Failed to fetch')) {
            errorTitle = "Network error";
            errorMessage = "Network request failed. Please check your connection and try again.";
          } else {
            errorMessage = error.message;
          }
        }
        
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });
        setStage('idle');
        setProgress(0);
      }
    };

    try {
      await attemptUpload();
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveLog = async () => {
    if (!user || !nutritionData) return;

    setStage('saving');
    setProgress(70);
    
    try {
      // Use the current local time for logged_at
      const now = new Date();
      
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
          logged_at: now.toISOString(), // Explicitly set the timestamp
        });

      if (error) {
        console.error('Error inserting food log:', error);
        throw new Error(error.message || 'Failed to save food log');
      }

      setProgress(90);

      toast({
        title: "Meal logged!",
        description: "Your nutrition data has been saved",
      });

      // Calculate nutrition score after logging food
      try {
        const session = (await supabase.auth.getSession()).data.session;
        await supabase.functions.invoke('calculate-nutrition-score', {
          body: { date: format(new Date(), 'yyyy-MM-dd') },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        });
      } catch (scoreError) {
        console.error('Error calculating nutrition score:', scoreError);
      }
      
      setProgress(100);
      setStage('complete');
      
      // Reset and close after a brief delay
      setTimeout(() => {
        setNutritionData(null);
        setStage('idle');
        setProgress(0);
        onOpenChange(false);
      }, 1000);
    } catch (error) {
      console.error('Error saving food log:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Save failed",
        description: errorMessage,
        variant: "destructive",
      });
      setStage('idle');
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Food Tracker
          </DialogTitle>
          <DialogDescription>
            Take or upload a photo of your food to log it automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Indicator */}
          {stage !== 'idle' && stage !== 'complete' && (
            <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-fade-in">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-primary flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {getStageMessage(stage)}
                </span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Meal Type */}
          <div className="space-y-2">
            <Label htmlFor="meal-type">Meal Type</Label>
            <Select value={mealType} onValueChange={setMealType} disabled={stage !== 'idle' && stage !== 'complete'}>
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

          {/* Upload Area */}
          <div className="space-y-3">
            <Label>Upload Food Photo</Label>
            <div className="relative">
              <label htmlFor="food-image">
                <div className={`
                  w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200
                  ${stage !== 'idle' && stage !== 'complete' 
                    ? 'border-muted bg-muted/50 cursor-not-allowed' 
                    : 'border-primary/50 bg-primary/5 hover:border-primary hover:bg-primary/10'
                  }
                `}>
                  {stage === 'uploading' || stage === 'analyzing' ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-sm font-medium text-primary">
                        {stage === 'uploading' ? 'Uploading...' : 'Analyzing...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Camera className="h-8 w-8 text-primary" />
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">
                          Take Photo or Upload Image
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Click to select or drag & drop
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </label>
              <input
                id="food-image"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageUpload}
                disabled={stage !== 'idle' && stage !== 'complete'}
              />
            </div>
            
            {/* Alternative upload methods */}
            {stage === 'idle' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => document.getElementById('food-image')?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Camera
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const input = document.getElementById('food-image') as HTMLInputElement;
                    input.removeAttribute('capture');
                    input.click();
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Gallery
                </Button>
              </div>
            )}
          </div>

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
                disabled={stage === 'saving'}
                className="w-full mt-2"
              >
                {stage === 'saving' ? (
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
