import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Apple, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Footprints,
  Flame,
  Heart,
  Activity,
  Clock,
  Info
} from 'lucide-react';
import { useHealthKit } from '@/hooks/useHealthKit';
import { useToast } from '@/hooks/use-toast';

interface HealthPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function HealthPermissionsDialog({ open, onOpenChange, onComplete }: HealthPermissionsDialogProps) {
  const { 
    isAvailable, 
    isAuthorized, 
    permissions, 
    requestAuthorization, 
    checkAuthorizationStatus 
  } = useHealthKit();
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  useEffect(() => {
    if (open && isAvailable) {
      checkAuthorizationStatus();
    }
  }, [open, isAvailable, checkAuthorizationStatus]);

  const handleRequestPermissions = async () => {
    if (!isAvailable) {
      toast({
        title: "Not Available",
        description: "Apple Health is only available on iOS devices",
        variant: "destructive",
      });
      return;
    }

    setIsRequesting(true);
    setHasRequested(true);

    try {
      const result = await requestAuthorization();
      
      const grantedCount = Object.values(result).filter(status => status === 'granted').length;
      
      if (grantedCount > 0) {
        toast({
          title: "Permissions Granted",
          description: `Successfully connected to Apple Health with ${grantedCount} data types`,
        });
        
        if (onComplete) {
          onComplete();
        }
      } else {
        toast({
          title: "No Permissions Granted",
          description: "Please enable health data access in Settings to use this feature",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to request permissions:', error);
      toast({
        title: "Permission Error",
        description: "Failed to request health data permissions",
        variant: "destructive",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  const getPermissionIcon = (granted: boolean) => {
    return granted ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getPermissionBadge = (granted: boolean) => {
    return granted ? (
      <Badge className="bg-green-500">Granted</Badge>
    ) : (
      <Badge variant="secondary">Not Granted</Badge>
    );
  };

  if (!isAvailable) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Apple className="h-5 w-5" />
              Apple Health Not Available
            </DialogTitle>
            <DialogDescription>
              Apple Health integration is only available on iOS devices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Use the mobile app or upload Apple Health export files instead.
              </span>
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Apple className="h-5 w-5" />
            Apple Health Integration
          </DialogTitle>
          <DialogDescription>
            Connect to Apple Health to automatically sync your fitness and health data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Privacy Notice */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-blue-900">Privacy & Security</h4>
                  <p className="text-xs text-blue-700">
                    Your health data stays on your device and is only used to provide personalized nutrition insights. 
                    We never share your health data with third parties.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Types */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Health Data Types</h4>
            <div className="grid grid-cols-1 gap-3">
              {/* Steps */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Footprints className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Steps</Label>
                    <p className="text-xs text-muted-foreground">Daily step count for activity tracking</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPermissionIcon(permissions.steps)}
                  {getPermissionBadge(permissions.steps)}
                </div>
              </div>

              {/* Calories */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Flame className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Active Calories</Label>
                    <p className="text-xs text-muted-foreground">Calories burned through activity</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPermissionIcon(permissions.calories)}
                  {getPermissionBadge(permissions.calories)}
                </div>
              </div>

              {/* Heart Rate */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Heart Rate</Label>
                    <p className="text-xs text-muted-foreground">Resting and active heart rate data</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPermissionIcon(permissions.heartRate)}
                  {getPermissionBadge(permissions.heartRate)}
                </div>
              </div>

              {/* Distance */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Distance</Label>
                    <p className="text-xs text-muted-foreground">Walking and running distance</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPermissionIcon(permissions.distance)}
                  {getPermissionBadge(permissions.distance)}
                </div>
              </div>

              {/* Active Minutes */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Active Minutes</Label>
                    <p className="text-xs text-muted-foreground">Time spent in active exercise</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPermissionIcon(permissions.activeMinutes)}
                  {getPermissionBadge(permissions.activeMinutes)}
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              {isAuthorized ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {isAuthorized ? 'Connected to Apple Health' : 'Not Connected'}
              </span>
            </div>
            <Badge variant={isAuthorized ? 'default' : 'secondary'}>
              {isAuthorized ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleRequestPermissions}
              disabled={isRequesting || isAuthorized}
              className="flex-1"
            >
              {isRequesting ? 'Requesting...' : isAuthorized ? 'Already Connected' : 'Connect to Apple Health'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isAuthorized ? 'Done' : 'Cancel'}
            </Button>
          </div>

          {/* Help Text */}
          <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Need help?</p>
              <p>
                If you've already granted permissions but they're not showing as granted, 
                try opening the Health app and ensuring the permissions are enabled there.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
