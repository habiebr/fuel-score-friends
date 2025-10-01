import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Target, Calendar, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handleGoToPage = (path: string) => {
    onComplete();
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Nutrisync!</DialogTitle>
          <DialogDescription>Let's get you started in 3 simple steps</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress indicator */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-2 w-12 rounded-full transition-colors ${
                  i === step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Set Your Goal */}
          {step === 1 && (
            <div className="text-center space-y-4 animate-fade-in">
              <div className="flex justify-center">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Target className="h-12 w-12 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold">Set Your Goal</h3>
              <p className="text-muted-foreground">
                Define your race goals and training targets to get personalized nutrition recommendations.
              </p>
              <Button onClick={() => handleGoToPage('/goals')} className="w-full">
                Set My Goal
              </Button>
              <Button onClick={handleNext} variant="ghost" className="w-full">
                Skip for now
              </Button>
            </div>
          )}

          {/* Step 2: Sync Your Plan */}
          {step === 2 && (
            <div className="text-center space-y-4 animate-fade-in">
              <div className="flex justify-center">
                <div className="p-4 bg-accent/10 rounded-full">
                  <Calendar className="h-12 w-12 text-accent" />
                </div>
              </div>
              <h3 className="text-xl font-semibold">Sync Your Training Plan</h3>
              <p className="text-muted-foreground">
                Upload your training plan image or connect your wearable device to track your activities.
              </p>
              <Button onClick={() => handleGoToPage('/profile')} className="w-full">
                Sync Now
              </Button>
              <Button onClick={handleNext} variant="ghost" className="w-full">
                Skip for now
              </Button>
            </div>
          )}

          {/* Step 3: Get Suggestions */}
          {step === 3 && (
            <div className="text-center space-y-4 animate-fade-in">
              <div className="flex justify-center">
                <div className="p-4 bg-secondary/10 rounded-full">
                  <Sparkles className="h-12 w-12 text-secondary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold">Get AI Meal Suggestions</h3>
              <p className="text-muted-foreground">
                Our AI analyzes your training data and provides personalized nutrition recommendations daily.
              </p>
              <Button onClick={handleNext} className="w-full">
                Get Started
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
