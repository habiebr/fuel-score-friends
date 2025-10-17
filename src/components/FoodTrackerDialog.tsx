import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Camera, Upload, Loader2, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { InAppCamera } from '@/components/InAppCamera';

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
  const [showInAppCamera, setShowInAppCamera] = useState(false);
  const isProcessingRef = useRef(false); // Prevent race conditions on Android

  // Detect if we're on Android
  const isAndroid = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent);
  };

  // Detect if running as PWA (installed app)
  const isPWA = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || 
           (window.navigator as any).standalone === true ||
           document.referrer.includes('android-app://');
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Only reset if we're not in the middle of processing
      // Check both state AND ref to prevent Android race conditions
      if (!isProcessingRef.current && stage !== 'uploading' && stage !== 'analyzing' && stage !== 'saving') {
        setStage('idle');
        setProgress(0);
        setNutritionData(null);
      }
    }
  }, [open, stage]);

  const getStageMessage = (currentStage: ProcessStage) => {
    switch (currentStage) {
      case 'uploading': return 'Preparing image...';
      case 'analyzing': return 'Analyzing food with AI...';
      case 'saving': return 'Saving to your log...';
      case 'complete': return 'Complete!';
      default: return '';
    }
  };

  // Compress image for faster upload (especially for Samsung gallery photos)
  const compressImage = async (file: File, maxSizeMB: number = 2): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize if too large (Samsung photos can be 4000x3000+)
          const maxDimension = 1920; // Max 1920px for food photos
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels to hit target size
          let quality = 0.85;
          const tryCompress = () => {
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              const sizeMB = blob.size / (1024 * 1024);
              console.log(`📸 Compressed to ${sizeMB.toFixed(2)}MB at quality ${quality}`);
              
              // If still too large and we can reduce quality more, try again
              if (sizeMB > maxSizeMB && quality > 0.5) {
                quality -= 0.1;
                tryCompress();
              } else {
                resolve(blob);
              }
            }, 'image/jpeg', quality);
          };
          
          tryCompress();
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      isProcessingRef.current = false; // Reset if no file selected
      return;
    }

    if (!file.type.startsWith('image/')) {
      isProcessingRef.current = false;
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      isProcessingRef.current = false;
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    // Set ref immediately to prevent dialog from resetting on Android
    console.log('📸 Android fix: Setting isProcessingRef to prevent dialog reset');
    const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`📸 Original file size: ${originalSizeMB}MB`);
    
    isProcessingRef.current = true;
    
    setStage('uploading');
    setProgress(10);
    setNutritionData(null);

    let retryCount = 0;
    const maxRetries = 2;

    const attemptUpload = async (): Promise<void> => {
      try {
        // Get and validate session BEFORE starting (prevent auth race condition)
        console.log('🔐 Getting fresh session before upload...');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData.session) {
          console.error('Session error:', sessionError);
          throw new Error('Authentication expired. Please refresh the page and try again.');
        }
        
        const session = sessionData.session;
        console.log('✅ Session valid, token expires:', new Date(session.expires_at! * 1000).toLocaleString());
        
        // Compress image first (especially important for Samsung gallery photos)
        setProgress(20);
        console.log('📸 Compressing image for faster upload...');
        
        // Show toast for large files so user knows we're working on it
        if (file.size > 3 * 1024 * 1024) {
          toast({
            title: "Optimizing image...",
            description: `Large file detected (${originalSizeMB}MB), compressing for faster upload`,
          });
        }
        
        const compressedBlob = await compressImage(file, 2); // Max 2MB
        const compressedSizeMB = (compressedBlob.size / (1024 * 1024)).toFixed(2);
        console.log(`📸 Compressed: ${originalSizeMB}MB → ${compressedSizeMB}MB`);
        
        // Show success for large compressions
        if (parseFloat(originalSizeMB) > 5) {
          toast({
            title: "Image optimized!",
            description: `Reduced from ${originalSizeMB}MB to ${compressedSizeMB}MB`,
          });
        }
        
        setProgress(30);
        
        // Upload compressed file to Supabase Storage with timeout
        setProgress(40);
        const userId = user?.id || 'anonymous';
        const fileExt = 'jpg'; // Always save as JPEG after compression
        const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const bucket = supabase.storage.from('food-photos');
        
        // Upload with longer timeout for slower connections
        const uploadPromise = bucket.upload(path, compressedBlob, { 
          upsert: true, 
          contentType: 'image/jpeg' 
        });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout - please check your internet connection')), 45000)
        );
        
        const uploadRes = await Promise.race([uploadPromise, timeoutPromise]) as any;
        if (uploadRes.error) throw uploadRes.error;
        
        const signed = await bucket.createSignedUrl(path, 600); // 10 minutes
        if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error('Failed to create signed URL');

        setStage('analyzing');
        setProgress(60);
        
        // Call edge function with session token from the start (no race condition)
        console.log('🔐 Using session token for edge function...');
        const invokePromise = supabase.functions.invoke('nutrition-ai', {
          body: { 
            type: 'food_photo',
            image: signed.data.signedUrl,
            mealType
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        
        const edgeFunctionTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Analysis timeout - AI is taking too long to respond')), 60000)
        );
        
        const result = await Promise.race([invokePromise, edgeFunctionTimeout]) as any;

        // Handle edge function errors (status 500 when AI fails)
        if (result.error) {
          console.error('❌ Nutrition AI error:', result.error);
          console.error('Error details:', {
            message: result.error.message,
            status: result.error.status,
            statusText: result.error.statusText,
            context: result.error.context
          });
          
          // Check for auth errors (401, 403)
          const isAuthError = result.error.status === 401 || 
                             result.error.status === 403 || 
                             result.error.message?.includes('Unauthorized') ||
                             result.error.message?.includes('Authentication');
          
          if (isAuthError) {
            console.error('🔐 Auth error detected - session may have expired during upload');
            throw new Error('Authentication expired. Please refresh the page and try again.');
          }
          
          // Check for network errors that can be retried
          const isNetworkError = result.error.message?.includes('Failed to send') || 
                                 result.error.message?.includes('network') ||
                                 result.error.message?.includes('fetch') ||
                                 result.error.message?.includes('NetworkError');
          
          if (isNetworkError && retryCount < maxRetries) {
            retryCount++;
            console.log(`🔄 Retrying... Attempt ${retryCount + 1} of ${maxRetries + 1}`);
            toast({
              title: "Connection issue",
              description: `Retrying... (${retryCount}/${maxRetries})`,
            });
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            return attemptUpload();
          }
          
          throw new Error(result.error.message || `Failed to analyze food (${result.error.status || 'unknown error'})`);
        }
        
        // If status code is not 2xx but no error object, check response data
        const { data, error } = result;
        
        if (error || (data && data.error)) {
          const errorDetails = error || data.error;
          console.error('❌ Edge function returned error:', errorDetails);
          
          // Extract meaningful error message
          let errorMsg = 'Failed to analyze food';
          if (typeof errorDetails === 'string') {
            errorMsg = errorDetails;
          } else if (errorDetails.details) {
            errorMsg = errorDetails.details;
          } else if (errorDetails.error) {
            errorMsg = errorDetails.error;
          } else if (errorDetails.message) {
            errorMsg = errorDetails.message;
          }
          
          // Log additional context
          if (errorDetails.error_type) {
            console.error('Error type:', errorDetails.error_type);
          }
          if (errorDetails.raw_response) {
            console.error('Raw AI response:', errorDetails.raw_response);
          }
          
          throw new Error(errorMsg);
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
          if (error.message.includes('Authentication') || error.message.includes('expired')) {
            errorTitle = "Session expired";
            errorMessage = "Your session has expired. Please refresh the page and try again.";
          } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorTitle = "Authentication error";
            errorMessage = "Authentication failed. Please refresh the page and log in again.";
          } else if (error.message.includes('AI returned an invalid format') || error.message.includes('parse nutrition data')) {
            errorTitle = "AI analysis failed";
            errorMessage = "The AI couldn't understand the food in this image. Try taking a clearer photo with better lighting.";
          } else if (error.message.includes('Gemini') || error.message.includes('analyze image')) {
            errorTitle = "AI service error";
            errorMessage = "The AI service is temporarily unavailable. Please try again in a moment.";
          } else if (error.message.includes('Image processing failed') || error.message.includes('fetch image')) {
            errorTitle = "Image error";
            errorMessage = "Unable to process the image. Please try taking a new photo.";
          } else if (error.message.includes('compress')) {
            errorTitle = "Image processing failed";
            errorMessage = "Unable to process the image. Please try taking a new photo or selecting a different image.";
          } else if (error.message.includes('timeout')) {
            errorTitle = "Request timed out";
            errorMessage = "The request took too long. Please check your internet connection and try again.";
          } else if (error.message.includes('Failed to send') || error.message.includes('NetworkError')) {
            errorTitle = "Connection error";
            errorMessage = "Unable to reach the server. Please check your internet connection and try again.";
          } else if (error.message.includes('Failed to fetch')) {
            errorTitle = "Network error";
            errorMessage = "Network request failed. Please check your connection and try again.";
          } else if (error.message.includes('load image') || error.message.includes('read file')) {
            errorTitle = "Image error";
            errorMessage = "Unable to read the image file. Please try a different photo.";
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
        isProcessingRef.current = false; // Reset on error
      }
    };

    try {
      await attemptUpload();
    } finally {
      event.target.value = '';
      // Only reset ref if not in a processing state (to allow saving after analysis)
      if (stage !== 'complete') {
        isProcessingRef.current = false;
      }
    }
  };

  const handleInAppCameraCapture = async (file: File) => {
    // Close in-app camera
    setShowInAppCamera(false);
    
    // Process the captured image
    await processImageFile(file);
  };

  const processImageFile = async (file: File) => {
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

    // Get session FIRST before starting upload
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      toast({
        title: "Authentication error",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }
    const session = sessionData.session;

    isProcessingRef.current = true;
    const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`📸 Processing image: ${originalSizeMB}MB`);
    
    setStage('uploading');
    setProgress(10);
    setNutritionData(null);

    let retryCount = 0;
    const maxRetries = 2;

    const attemptUpload = async (): Promise<void> => {
      try {
        console.log('🗜️ Compressing image...');
        const compressedFile = await compressImage(file);
        const compressedSizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
        console.log(`📦 Compressed size: ${compressedSizeMB}MB (${((compressedFile.size / file.size) * 100).toFixed(1)}% of original)`);

        setProgress(20);

        // Upload to Supabase Storage
        const userId = user?.id || 'anonymous';
        const fileExt = 'jpg';
        const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const bucket = supabase.storage.from('food-photos');
        
        console.log('☁️ Uploading to Supabase Storage:', path);
        const uploadPromise = bucket.upload(path, compressedFile, { 
          upsert: true, 
          contentType: 'image/jpeg' 
        });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout - please check your internet connection')), 45000)
        );
        
        const uploadRes = await Promise.race([uploadPromise, timeoutPromise]) as any;
        if (uploadRes.error) throw uploadRes.error;
        
        console.log('✅ Upload successful:', uploadRes.data.path);
        setProgress(30);
        
        const signed = await bucket.createSignedUrl(uploadRes.data.path, 600);
        if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error('Failed to create signed URL');

        setStage('analyzing');
        setProgress(60);
        
        console.log('🤖 Calling AI nutrition analysis...');
        const invokePromise = supabase.functions.invoke('nutrition-ai', {
          body: { 
            type: 'food_photo',
            image: signed.data.signedUrl,
            mealType
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        
        const edgeFunctionTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Analysis timeout - AI is taking too long to respond')), 60000)
        );
        
        const result = await Promise.race([invokePromise, edgeFunctionTimeout]) as any;

        if (result.error) {
          console.error('❌ Nutrition AI error:', result.error);
          console.error('Error details:', {
            message: result.error.message,
            status: result.error.status,
            statusText: result.error.statusText,
          });
          
          const isAuthError = result.error.status === 401 || 
                             result.error.status === 403 || 
                             result.error.message?.includes('Unauthorized') ||
                             result.error.message?.includes('Authentication');
          
          if (isAuthError) {
            throw new Error('Authentication expired. Please refresh the page and try again.');
          }
          
          throw new Error(result.error.message || 'Failed to analyze food');
        }

        const { data, error } = result;
        
        if (error || (data && data.error)) {
          const errorDetails = error || data.error;
          console.error('❌ Edge function returned error:', errorDetails);
          throw new Error(typeof errorDetails === 'string' ? errorDetails : errorDetails.message || 'Failed to analyze food');
        }

        setProgress(90);

        if (data?.nutritionData) {
          setNutritionData(data.nutritionData);
          setStage('complete');
          setProgress(100);
          console.log('✨ Food analysis ready for user review');
          toast({
            title: "Food analyzed!",
            description: `Found: ${data.nutritionData.food_name}`,
          });
        } else {
          throw new Error('No nutrition data received from AI');
        }

      } catch (error) {
        console.error('Error analyzing food:', error);
        
        let errorTitle = "Analysis failed";
        let errorMessage = "Unknown error occurred";
        
        if (error instanceof Error) {
          if (error.message.includes('Authentication') || error.message.includes('expired')) {
            errorTitle = "Session expired";
            errorMessage = "Your session has expired. Please refresh the page and try again.";
          } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorTitle = "Authentication error";
            errorMessage = "Authentication failed. Please refresh the page and log in again.";
          } else if (error.message.includes('timeout')) {
            errorTitle = "Request timed out";
            errorMessage = "The request took too long. Please check your internet connection and try again.";
          } else if (error.message.includes('Failed to send') || error.message.includes('NetworkError')) {
            errorTitle = "Connection error";
            errorMessage = "Unable to reach the server. Please check your internet connection and try again.";
          } else {
            errorMessage = error.message;
          }
        }
        
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });

        if (retryCount < maxRetries && (
          error instanceof Error && (
            error.message?.includes('timeout') || 
            error.message?.includes('network') ||
            error.message?.includes('fetch')
          )
        )) {
          retryCount++;
          console.log(`🔄 Retrying... Attempt ${retryCount + 1} of ${maxRetries + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          return attemptUpload();
        }

        setStage('idle');
        setProgress(0);
        isProcessingRef.current = false;
      }
    };

    try {
      await attemptUpload();
    } finally {
      if (stage !== 'complete') {
        isProcessingRef.current = false;
      }
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
        isProcessingRef.current = false; // Reset after save complete
        onOpenChange(false);
      }, 1000);
    } catch (error) {
      console.error('Error saving food log:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      isProcessingRef.current = false; // Reset on save error
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
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
            {/* Notice: 1 plate per meal */}
            <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-1">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">Upload 1 plate per meal</span>
                <p className="mt-1">For best results, please upload a photo showing only one plate per meal. This helps us identify your food more accurately.</p>
              </div>
            </div>
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
                {... (isAndroid() && !isPWA() ? {} : { capture: "environment" as const })}
                className="hidden"
                onChange={handleImageUpload}
                disabled={stage !== 'idle' && stage !== 'complete'}
              />
            </div>
            
            {/* Alternative upload methods */}
            {stage === 'idle' && (
              <div className="space-y-2">
                {/* In-App Camera (Primary for Android) */}
                <Button
                  variant={isAndroid() ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => setShowInAppCamera(true)}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  In-App Camera
                  {isAndroid() && <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">Recommended</span>}
                </Button>
                
                {/* Traditional file inputs */}
                <div className="flex gap-2">
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
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Gallery
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => document.getElementById('food-image')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
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
    
    {/* In-App Camera Modal */}
    <InAppCamera
      open={showInAppCamera}
      onClose={() => setShowInAppCamera(false)}
      onCapture={handleInAppCameraCapture}
    />
    </>
  );
}
