import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Activity } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';

export default function ProfileInformation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    sex: 'male',
    weight_kg: '',
    height_cm: '',
    age: ''
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    setFormData(prev => ({ ...prev, email: user.email || '' }));

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setFormData({
        full_name: data.full_name || '',
        email: user.email || '',
        sex: data.sex || 'male',
        weight_kg: data.weight_kg?.toString() || '',
        height_cm: data.height_cm?.toString() || '',
        age: data.age?.toString() || ''
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          full_name: formData.full_name,
          sex: formData.sex,
          weight_kg: parseFloat(formData.weight_kg) || null,
          height_cm: parseFloat(formData.height_cm) || null,
          age: parseInt(formData.age) || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your information has been saved successfully.",
      });

      navigate('/profile');
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Could not save your profile.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="w-full mx-auto">
          {/* Header */}
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/profile')}
                className="flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Activity className="w-6 h-6 text-white dark:text-black" />
                  </div>
                <AppHeader />
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Profile Information</h2>

            <Card className="shadow-card mb-6">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg mb-4">Personal Information</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Update your personal details and body metrics
                </p>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    placeholder="Alex Runner"
                    className="bg-gray-100 dark:bg-gray-800 border-0"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    disabled
                    className="bg-gray-100 dark:bg-gray-800 border-0"
                  />
                </div>

                {/* Sex */}
                <div className="space-y-2">
                  <Label htmlFor="sex">Sex</Label>
                  <Select
                    value={formData.sex}
                    onValueChange={(value) => setFormData({...formData, sex: value})}
                  >
                    <SelectTrigger className="bg-gray-100 dark:bg-gray-800 border-0">
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Required for accurate BMR calculation (Mifflin-St Jeor equation)
                  </p>
                </div>

                {/* Body Metrics Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={formData.weight_kg}
                      onChange={(e) => setFormData({...formData, weight_kg: e.target.value})}
                      placeholder="70"
                      className="bg-gray-100 dark:bg-gray-800 border-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={formData.height_cm}
                      onChange={(e) => setFormData({...formData, height_cm: e.target.value})}
                      placeholder="175"
                      className="bg-gray-100 dark:bg-gray-800 border-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({...formData, age: e.target.value})}
                      placeholder="28"
                      className="bg-gray-100 dark:bg-gray-800 border-0"
                    />
                  </div>
                </div>

                {/* Info about activity level */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Activity Level</strong> is automatically calculated from your Training Goals and Session data. 
                    Set your goals to get personalized nutrition targets.
                  </p>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-12 text-base font-semibold"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
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

