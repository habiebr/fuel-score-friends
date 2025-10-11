import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, Activity, Bell } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';
import { PageHeading } from '@/components/PageHeading';
import { usePWA } from '@/hooks/usePWA';

export default function NotificationsSettings() {
  const navigate = useNavigate();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);
  const { enablePushNotifications } = usePWA();

  const [notifications, setNotifications] = useState({
    mealReminders: true,
    hydrationAlerts: true,
    preRunNutrition: true,
    postRunRecovery: true,
    weeklyProgress: false
  });

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const notificationItems = [
    {
      key: 'mealReminders' as const,
      title: 'Meal Reminders',
      subtitle: "Get notified when it's time for meals"
    },
    {
      key: 'hydrationAlerts' as const,
      title: 'Hydration Alerts',
      subtitle: 'Regular reminders to drink water'
    },
    {
      key: 'preRunNutrition' as const,
      title: 'Pre-Run Nutrition',
      subtitle: 'Reminders before scheduled runs'
    },
    {
      key: 'postRunRecovery' as const,
      title: 'Post-Run Recovery',
      subtitle: 'Recovery nutrition after runs'
    },
    {
      key: 'weeklyProgress' as const,
      title: 'Weekly Progress',
      subtitle: 'Weekly summary reports'
    }
  ];

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
          {/* Header */}
          <div className="mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/profile')}
              className="-ml-2 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 mb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg sm:h-12 sm:w-12">
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <PageHeading
              title="Notifications"
              description="Manage your notification preferences"
              className="!mb-0 flex-1"
            />
          </div>

          {/* Content */}
          <div className="space-y-4">

            <Card className="shadow-card">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-2">Notification Preferences</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Choose when and how you want to be reminded
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3">
                    <div className="flex-1 min-w-0 mr-4">
                      <h4 className="font-semibold text-base">Enable Push Notifications</h4>
                      <p className="text-sm text-muted-foreground mt-0.5">Allow NutriSync to send alerts to your device</p>
                    </div>
                    <Button variant="outline" onClick={enablePushNotifications}>Enable</Button>
                  </div>
                  {notificationItems.map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3">
                      <div className="flex-1 min-w-0 mr-4">
                        <h4 className="font-semibold text-base">{item.title}</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{item.subtitle}</p>
                      </div>
                      <Switch
                        checked={notifications[item.key]}
                        onCheckedChange={() => toggleNotification(item.key)}
                        className="flex-shrink-0"
                      />
                    </div>
                  ))}
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
