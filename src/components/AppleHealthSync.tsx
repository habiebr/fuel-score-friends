import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Apple, Upload, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export function AppleHealthSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleAppleHealthXML = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Apple Health export XML file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      
      // Extract health records
      const records = xmlDoc.querySelectorAll('Record');
      const workouts = xmlDoc.querySelectorAll('Workout');
      
      let totalSteps = 0;
      let totalCalories = 0;
      let heartRateSum = 0;
      let heartRateCount = 0;
      let activeMinutes = 0;
      
      // Parse records
      records.forEach(record => {
        const type = record.getAttribute('type');
        const value = parseFloat(record.getAttribute('value') || '0');
        const startDate = record.getAttribute('startDate');
        
        if (type?.includes('StepCount')) {
          totalSteps += value;
        } else if (type?.includes('ActiveEnergyBurned')) {
          totalCalories += value;
        } else if (type?.includes('HeartRate')) {
          heartRateSum += value;
          heartRateCount++;
        }
      });
      
      // Parse workouts
      workouts.forEach(workout => {
        const duration = parseFloat(workout.getAttribute('duration') || '0');
        const calories = parseFloat(workout.getAttribute('totalEnergyBurned') || '0');
        
        activeMinutes += Math.floor(duration / 60);
        totalCalories += calories;
      });
      
      // Save to database
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('wearable_data')
        .upsert({
          user_id: user?.id,
          date: today,
          steps: Math.round(totalSteps),
          calories_burned: Math.round(totalCalories),
          active_minutes: activeMinutes,
          heart_rate_avg: heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : 0,
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;

      setLastSync(new Date());
      toast({
        title: "Apple Health data synced!",
        description: `Imported ${records.length} records and ${workouts.length} workouts`,
      });
    } catch (error) {
      console.error('Error parsing Apple Health XML:', error);
      toast({
        title: "Upload failed",
        description: "Failed to parse Apple Health data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Apple className="h-5 w-5 text-foreground" />
          Apple Health (PWA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instructions */}
        <div className="flex items-start gap-2 p-3 bg-info/10 rounded-lg">
          <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-2">How to export from Apple Health:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open Health app on iPhone</li>
              <li>Tap profile picture (top right)</li>
              <li>Scroll down, tap "Export All Health Data"</li>
              <li>Share the export.zip file to this device</li>
              <li>Extract export.xml and upload here</li>
            </ol>
          </div>
        </div>

        {/* Upload Button */}
        <label htmlFor="apple-health-xml">
          <Button 
            variant="secondary" 
            className="w-full" 
            disabled={uploading}
            asChild
          >
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Processing...' : 'Upload export.xml'}
            </span>
          </Button>
          <input
            id="apple-health-xml"
            type="file"
            accept=".xml"
            className="hidden"
            onChange={handleAppleHealthXML}
            disabled={uploading}
          />
        </label>

        {/* Last Sync Status */}
        {lastSync && (
          <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-xs text-success">
              Last synced: {lastSync.toLocaleString()}
            </span>
          </div>
        )}

        {/* Note */}
        <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-xs text-muted-foreground">
            This imports data from your Apple Health export XML. For real-time sync, use the mobile app.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
