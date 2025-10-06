import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronLeft, X, Plus, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';

export default function FoodPreferences() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);

  const [restrictions, setRestrictions] = useState<string[]>(['Lactose Intolerant', 'No Red Meat']);
  const [behaviors, setBehaviors] = useState<string[]>(['Eat eggs for breakfast', 'No caffeine after 2 PM', 'Prefer plant-based proteins']);
  const [restrictionInput, setRestrictionInput] = useState('');
  const [behaviorInput, setBehaviorInput] = useState('');

  const addRestriction = () => {
    if (restrictionInput.trim() && !restrictions.includes(restrictionInput.trim())) {
      setRestrictions([...restrictions, restrictionInput.trim()]);
      setRestrictionInput('');
    }
  };

  const removeRestriction = (item: string) => {
    setRestrictions(restrictions.filter(r => r !== item));
  };

  const addBehavior = () => {
    if (behaviorInput.trim() && !behaviors.includes(behaviorInput.trim())) {
      setBehaviors([...behaviors, behaviorInput.trim()]);
      setBehaviorInput('');
    }
  };

  const removeBehavior = (item: string) => {
    setBehaviors(behaviors.filter(b => b !== item));
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
                  <div>
                    <h1 className="text-xl font-bold leading-tight">NutriSync</h1>
                    <p className="text-sm text-muted-foreground">Fuel Your Run</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Food Preferences</h2>

            {/* Dietary Restrictions */}
            <Card className="shadow-card mb-4">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-2">Dietary Restrictions</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage your dietary preferences and restrictions
                </p>

                {/* Chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {restrictions.map((item) => (
                    <div
                      key={item}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
                    >
                      <span>{item}</span>
                      <button
                        onClick={() => removeRestriction(item)}
                        className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={restrictionInput}
                    onChange={(e) => setRestrictionInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addRestriction()}
                    placeholder="Add dietary restriction..."
                    className="flex-1 bg-gray-100 dark:bg-gray-800 border-0"
                  />
                  <Button
                    onClick={addRestriction}
                    size="icon"
                    className="flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Eating Behaviors */}
            <Card className="shadow-card">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-2">Eating Behaviors</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Customize your eating habits and preferences
                </p>

                {/* Chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {behaviors.map((item) => (
                    <div
                      key={item}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
                    >
                      <span>{item}</span>
                      <button
                        onClick={() => removeBehavior(item)}
                        className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={behaviorInput}
                    onChange={(e) => setBehaviorInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addBehavior()}
                    placeholder="Add eating behavior..."
                    className="flex-1 bg-gray-100 dark:bg-gray-800 border-0"
                  />
                  <Button
                    onClick={addBehavior}
                    size="icon"
                    className="flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
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

