import { ArrowLeft, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
// import { GoogleFitTokenRefresh } from '@/components/GoogleFitTokenRefresh';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '@/components/PageHeading';

export default function Import() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-none mx-auto p-4">
        {/* Header with Back Button */}
        <div className="mb-2">
          <Button variant="ghost" onClick={() => navigate('/profile')} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </div>
        <PageHeading
          title="Google Fit Integration"
          description="Connect your Google Fit account to automatically sync your activity data."
          className="mt-3 mb-6"
        />

        {/* Google Fit Card */}
        <Card className="shadow-card">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-3">Connect Google Fit</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Automatically sync your steps, calories burned, active minutes, and heart rate data from Google Fit.
            </p>
            <Button 
              size="lg"
              onClick={() => navigate('/profile/integrations')}
              className="min-w-[200px]"
            >
              Go to App Integrations
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <div className="mt-6 p-6 bg-card border border-border rounded-lg">
          <h3 className="font-semibold text-lg mb-3">What data is synced?</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Daily steps:</strong> Track your movement throughout the day</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Calories burned:</strong> Monitor your energy expenditure</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Active minutes:</strong> See how much you move</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Heart rate:</strong> Average heart rate data (if available)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Activity sessions:</strong> Running, cycling, and other workouts</span>
            </li>
          </ul>
        </div>

        {/* Token Tools (disabled on this commit) */}
        {/* <div className="mt-6">
          <GoogleFitTokenRefresh />
        </div> */}
      </div>
    </div>
  );
}
