import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { ChevronRight, User as UserIcon, Utensils, Bell, Smartphone, Shield, Download, X, Target, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';
import { Activity } from 'lucide-react';
import { PageHeading } from '@/components/PageHeading';
import { DebugMenu } from '@/components/DebugMenu';

export default function ProfileNew() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    setProfile(data);
  };

  const menuItems = [
    {
      icon: UserIcon,
      title: 'Profile Information',
      subtitle: 'Personal details and body metrics',
      path: '/profile/information',
      iconBg: 'bg-gray-100 dark:bg-gray-800'
    },
    {
      icon: Target,
      title: 'Training Goals',
      subtitle: 'Set your fitness objectives',
      path: '/goals',
      iconBg: 'bg-gray-100 dark:bg-gray-800'
    },
    {
      icon: Utensils,
      title: 'Food Preferences',
      subtitle: 'Dietary restrictions and eating habits',
      path: '/profile/food-preferences',
      iconBg: 'bg-gray-100 dark:bg-gray-800'
    },
    {
      icon: Bell,
      title: 'Notifications',
      subtitle: 'Meal reminders and alerts',
      path: '/profile/notifications',
      iconBg: 'bg-gray-100 dark:bg-gray-800'
    },
    {
      icon: Smartphone,
      title: 'App Integrations',
      subtitle: 'Connected fitness apps and privacy',
      path: '/profile/integrations',
      iconBg: 'bg-gray-100 dark:bg-gray-800'
    }
  ];

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
          {/* Header */}
          <PageHeading
            title="Profile"
            description="Manage your account and preferences."
            className="pt-2"
          />

          {/* User Card */}
          <Card className="mb-4 shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-black dark:bg-white rounded-full flex items-center justify-center">
                  <UserIcon className="w-8 h-8 text-white dark:text-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-foreground truncate">
                    {profile?.full_name || 'Alex Runner'}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{profile?.weight_kg || 70}kg</span>
                    <span>•</span>
                    <span>{profile?.height_cm || 175}cm</span>
                    <span>•</span>
                    <span>{profile?.age || 28} years</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Menu Items */}
          <div className="space-y-3 mb-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.path}
                  className="shadow-card active:scale-[0.98] transition-transform cursor-pointer"
                  onClick={() => navigate(item.path)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${item.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-foreground leading-tight">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{item.subtitle}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Debug Section */}
          <h2 className="text-xl font-bold text-foreground mb-3">Debug</h2>
          <div className="space-y-3">
            <DebugMenu />
          </div>

          {/* Account Section */}
          <h2 className="text-xl font-bold text-foreground mb-3">Account</h2>
          <div className="space-y-3">
            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </div>
                  <span className="flex-1 font-medium">Export My Data</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-orange-200 dark:border-orange-800 cursor-pointer" onClick={handleLogout}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                    <LogOut className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="flex-1 font-medium text-orange-600 dark:text-orange-400">Logout</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-red-200 dark:border-red-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="flex-1 font-medium text-red-600 dark:text-red-400">Delete Account</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <BottomNav />
      <ActionFAB
        onLogMeal={() => setFoodTrackerOpen(true)}
        onUploadActivity={() => setFitnessScreenshotOpen(true)}
      />
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <FitnessScreenshotDialog open={fitnessScreenshotOpen} onOpenChange={setFitnessScreenshotOpen} />
    </>
  );
}
