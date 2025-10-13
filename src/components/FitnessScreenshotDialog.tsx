import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Upload, Utensils, Activity, Loader2 } from 'lucide-react';

interface MealSuggestion {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foods: string[];
}

interface Suggestions {
  instantRecoverySnack: MealSuggestion[];
  recoveryMeal: MealSuggestion[];
}

type ProcessStage = 'idle' | 'uploading' | 'analyzing' | 'complete';

interface FitnessScreenshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FitnessScreenshotDialog({ open, onOpenChange }: FitnessScreenshotDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stage, setStage] = useState<ProcessStage>('idle');
  const [progress, setProgress] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const getStageMessage = (currentStage: ProcessStage) => {
    switch (currentStage) {
      case 'uploading': return 'Uploading image...';
      case 'analyzing': return 'Generating suggestions...';
      case 'complete': return 'Suggestions ready!';
      default: return '';
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setStage('uploading');
    setProgress(0);
    setSuggestions(null);

    try {
      setProgress(20);
      
      // Upload image to Supabase Storage
      const userId = user?.id || 'anonymous';
      const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/fitness-screenshots/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const bucket = supabase.storage.from('fitness-screenshots');
      
      setProgress(40);
      const uploadRes = await bucket.upload(path, file, { upsert: true, contentType: file.type });
      if (uploadRes.error) throw uploadRes.error;
      
      setProgress(60);
      const signed = await bucket.createSignedUrl(path, 600); // 10 minutes
      if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error('Failed to create signed URL');

      setStage('analyzing');
      setProgress(80);
      
      // Fetch user profile/body metrics
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('age,height_cm,weight_kg,sex,activity_level,fitness_goals,body_fat')
        .eq('user_id', userId)
        .maybeSingle();
      if (profileError) {
        console.warn('Failed to load profile for analysis, proceeding without it:', profileError.message);
      }

      // Call the fitness analysis function
      const session = (await supabase.auth.getSession()).data.session;
      const { data, error } = await supabase.functions.invoke('analyze-fitness-screenshot', {
        body: { 
          image: signed.data.signedUrl,
          userProfile: profileData || null,
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (error) {
        console.error('Fitness analysis error:', error);
        throw new Error(error.message || 'Failed to analyze fitness screenshot');
      }

      setProgress(100);
      setStage('complete');

      console.debug('analyze-fitness-screenshot response:', data);
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        toast({
          title: "Suggestions ready!",
          description: "Recovery suggestions are ready",
        });
      } else if (data?.analysisResult) {
        const legacy = data.analysisResult as any;
        const meals: MealSuggestion[] = Array.isArray(legacy.mealSuggestions) ? legacy.mealSuggestions : [];
        setSuggestions({
          instantRecoverySnack: [],
          recoveryMeal: meals,
        });
        toast({
          title: "Suggestions ready!",
          description: "Recovery meal suggestions are ready",
        });
      } else {
        throw new Error('No suggestions received from AI');
      }
    } catch (error) {
      console.error('Error analyzing fitness screenshot:', error);
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Failed to analyze fitness screenshot",
        variant: "destructive",
      });
      setStage('idle');
      setProgress(0);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
  };

  const resetDialog = () => {
    setStage('idle');
    setProgress(0);
    setSuggestions(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetDialog();
    }}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Instant Suggestion
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {stage === 'idle' && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Upload Activity Photo</h3>
                <p className="text-muted-foreground">
                  Upload an image showing your activity stats
                </p>
              </div>
              
              <div
                className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="space-y-4">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">Drop your image here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                    id="fitness-screenshot-upload"
                  />
                  <Button asChild>
                    <label htmlFor="fitness-screenshot-upload" className="cursor-pointer">
                      Choose File
                    </label>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {(stage === 'uploading' || stage === 'analyzing') && (
            <div className="space-y-4">
              <div className="text-center">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                <h3 className="text-lg font-semibold mt-2">{getStageMessage(stage)}</h3>
                <p className="text-muted-foreground">
                  {stage === 'uploading' ? 'Uploading your image...' : 'Generating instant suggestions...'}
                </p>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {stage === 'complete' && suggestions && (
            <div className="space-y-6">
              {/* Instant Recovery Snack */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-primary" />
                    Instant Recovery Snack
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {suggestions.instantRecoverySnack.map((meal, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{meal.name}</h4>
                          <Badge variant="secondary">{meal.calories} cal</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{meal.description}</p>
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div className="text-center">
                            <p className="text-sm font-medium">{meal.protein}g</p>
                            <p className="text-xs text-muted-foreground">Protein</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">{meal.carbs}g</p>
                            <p className="text-xs text-muted-foreground">Carbs</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">{meal.fat}g</p>
                            <p className="text-xs text-muted-foreground">Fat</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {meal.foods.map((food, foodIndex) => (
                            <Badge key={foodIndex} variant="outline" className="text-xs">
                              {food}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recovery Meal */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-primary" />
                    Recovery Meal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {suggestions.recoveryMeal.map((meal, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{meal.name}</h4>
                          <Badge variant="secondary">{meal.calories} cal</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{meal.description}</p>
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div className="text-center">
                            <p className="text-sm font-medium">{meal.protein}g</p>
                            <p className="text-xs text-muted-foreground">Protein</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">{meal.carbs}g</p>
                            <p className="text-xs text-muted-foreground">Carbs</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">{meal.fat}g</p>
                            <p className="text-xs text-muted-foreground">Fat</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {meal.foods.map((food, foodIndex) => (
                            <Badge key={foodIndex} variant="outline" className="text-xs">
                              {food}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => resetDialog()}>
                  Get Another Suggestion
                </Button>
                <Button onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
