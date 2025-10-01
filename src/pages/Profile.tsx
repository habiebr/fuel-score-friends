import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WearablesSync } from '@/components/WearablesSync';
import { BottomNav } from '@/components/BottomNav';
import { LogOut, User, Target, Activity } from 'lucide-react';

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Profile</h1>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </div>

        {/* Wearables Sync */}
        <WearablesSync />

        {/* Profile Stats */}
        <Card className="shadow-card mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Your Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Days</span>
              <span className="font-semibold">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average Score</span>
              <span className="font-semibold">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Meals Logged</span>
              <span className="font-semibold">0</span>
            </div>
          </CardContent>
        </Card>

        {/* Goals */}
        <Card className="shadow-card mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => navigate('/goals')}
            >
              Set Your Goals
            </Button>
          </CardContent>
        </Card>

        {/* Activity */}
        <Card className="shadow-card mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => navigate('/activity')}
            >
              View Activity History
            </Button>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
