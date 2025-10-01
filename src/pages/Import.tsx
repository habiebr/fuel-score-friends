import { WearablesSync } from '@/components/WearablesSync';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Import() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header with Back Button */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/profile')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent mb-2">
              Import Activity Data
            </h1>
            <p className="text-muted-foreground">
              Sync your fitness data from Garmin devices and health apps
            </p>
          </div>
        </div>

        {/* Wearables Sync Component */}
        <WearablesSync />

        {/* Additional Info */}
        <div className="mt-6 p-4 bg-card border border-border rounded-lg">
          <h3 className="font-semibold mb-2">Supported Devices & Formats</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Google Fit (Real-time API integration)</li>
            <li>• Garmin devices (.fit files)</li>
            <li>• Apple Health (XML export)</li>
            <li>• Bulk import support for multiple files</li>
          </ul>
        </div>
      </div>
    </div>
  );
}