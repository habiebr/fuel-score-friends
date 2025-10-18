import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeading } from '@/components/PageHeading';
import { useAuth } from '@/hooks/useAuth';
import { usePWA } from '@/hooks/usePWA';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { supabase } from '@/integrations/supabase/client';
import { NutriSyncLogo } from '@/components/NutriSyncLogo';

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export default function OnboardingWizard({ onDone }: { onDone?: () => void }) {
  const { user } = useAuth();
  const { canInstall, installPWA } = usePWA() as any;
  const { connectGoogleFit } = useGoogleFitSync();

  const [step, setStep] = useState<Step>(0);

  // profile basics
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [city, setCity] = useState('');

  // preferences
  const [dietary, setDietary] = useState<string[]>([]);

  // goals & training
  const [goalType, setGoalType] = useState('5k');
  const [goalName, setGoalName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('beginner');
  const [trainingTemplate, setTrainingTemplate] = useState<'balanced' | 'base' | 'intensity'>('balanced');

  const saveProfileBasics = async () => {
    if (!user) return;
    await (supabase as any).from('profiles').upsert({
      user_id: user.id,
      full_name: name,
      age: age ? Number(age) : null,
      sex: sex || null,
      height_cm: height ? Number(height) : null,
      weight_kg: weight ? Number(weight) : null,
      city: city || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  };

  const saveDietary = async () => {
    if (!user) return;
    await (supabase as any).from('user_preferences').upsert({
      user_id: user.id,
      key: 'dietary_restrictions',
      value: { items: dietary },
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,key' });
  };

  const saveGoals = async () => {
    if (!user) return;
    // Save to profiles for existing schema fields
    await (supabase as any).from('profiles').upsert({
      user_id: user.id,
      goal_type: goalType,
      goal_name: goalName || goalType,
      target_date: targetDate || null,
      fitness_level: fitnessLevel,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    // Save training template to preferences
    await (supabase as any).from('user_preferences').upsert({
      user_id: user.id,
      key: 'training_template',
      value: { template: trainingTemplate },
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,key' });
  };

  const next = async () => {
    if (step === 1) await saveProfileBasics();
    if (step === 2) await saveDietary();
    if (step === 3) await saveGoals();
    setStep((prev => (Math.min(9, (prev + 1)) as Step)));
  };

  const prev = () => setStep(prev => (Math.max(0, (prev - 1)) as Step));

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const stepParam = params.get('step');
      if (stepParam) {
        const n = Number(stepParam);
        if (!Number.isNaN(n)) setStep(Math.min(9, Math.max(0, n)) as Step);
      }
    } catch {}
  }, []);

  const StepHeader = (
    <PageHeading title={step === 0 ? 'Welcome' : 'Onboarding'} description={step === 0 ? 'Let’s complete your profile.' : undefined} />
  );

  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
        {StepHeader}
        <Card className="shadow-card">
          <CardContent className="p-6 space-y-4">
            {step === 0 && (
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <NutriSyncLogo size="xl" />
                </div>
                <h3 className="text-2xl font-bold">Welcome!</h3>
                <p className="text-lg text-muted-foreground">We will guide you to experience the best of this app.</p>
                <div className="flex justify-center"><Button onClick={next} size="lg">Get Started</Button></div>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 gap-4">
                <h3 className="text-lg font-semibold">Basics</h3>
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Age</Label>
                  <Input value={age} onChange={e => setAge(e.target.value)} type="number" />
                </div>
                <div>
                  <Label>Sex</Label>
                  <Select value={sex} onValueChange={(v: any) => setSex(v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Height (cm)</Label>
                  <Input value={height} onChange={e => setHeight(e.target.value)} type="number" />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input value={weight} onChange={e => setWeight(e.target.value)} type="number" />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g., Jakarta" />
                </div>
                <div className="flex justify-between pt-2"><Button variant="outline" onClick={prev}>Back</Button><Button onClick={next}>Continue</Button></div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Dietary Restrictions</h3>
                <Label>Dietary restrictions</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {['Halal','Vegetarian','Vegan','Lactose-intolerant','Keto','Gluten-free','Low-carb','Allergies'].map(opt => (
                    <Button key={opt} variant={dietary.includes(opt) ? 'default' : 'outline'} onClick={() => setDietary(prev => prev.includes(opt) ? prev.filter(x=>x!==opt) : [...prev,opt])}>{opt}</Button>
                  ))}
                </div>
                <div className="flex justify-between pt-2"><Button variant="outline" onClick={prev}>Back</Button><Button onClick={next}>Continue</Button></div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Race Goal</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>Goal</Label>
                    <Select value={goalType} onValueChange={(v:any)=>setGoalType(v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5k">5K</SelectItem>
                        <SelectItem value="10k">10K</SelectItem>
                        <SelectItem value="half">Half Marathon</SelectItem>
                        <SelectItem value="marathon">Marathon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Custom name (optional)</Label>
                    <Input value={goalName} onChange={e=>setGoalName(e.target.value)} placeholder="Jakarta Marathon" />
                  </div>
                  <div>
                    <Label>Target date</Label>
                    <Input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Fitness level</Label>
                    <Select value={fitnessLevel} onValueChange={(v:any)=>setFitnessLevel(v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Weekly training template</Label>
                    <Select value={trainingTemplate} onValueChange={(v:any)=>setTrainingTemplate(v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="balanced">Balanced (3 run, 1 strength)</SelectItem>
                        <SelectItem value="base">Base (easy mileage)</SelectItem>
                        <SelectItem value="intensity">Intensity (interval focus)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-between pt-2"><Button variant="outline" onClick={prev}>Back</Button><Button onClick={next}>Continue</Button></div>
              </div>
            )}

            {step === 4 && (
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold">Thank you for being our early user!</h3>
                <p className="text-lg text-muted-foreground">Your feedback helps us improve the app.</p>
                <div className="flex justify-center"><Button onClick={next} size="lg">Continue</Button></div>
              </div>
            )}

            {step === 5 && (
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold">Training Plan Setup</h3>
                <div className="w-full max-w-sm mx-auto">
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-4">
                    <span className="text-muted-foreground">Image 1: Training Plan</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">To get pre-training meal suggestions, please complete your training plan in the menu.</p>
                <div className="flex justify-between pt-2"><Button variant="outline" onClick={prev}>Back</Button><Button onClick={next}>Continue</Button></div>
              </div>
            )}

            {step === 6 && (
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold">Meal Logging</h3>
                <div className="w-full max-w-sm mx-auto">
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-4">
                    <span className="text-muted-foreground">Image 2: Meal Logging</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">To log your meal, please click the button on the right bottom corner.</p>
                <div className="flex justify-between pt-2"><Button variant="outline" onClick={prev}>Back</Button><Button onClick={next}>Continue</Button></div>
              </div>
            )}

            {step === 7 && (
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold">Add to Home Screen</h3>
                <div className="w-full max-w-sm mx-auto">
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-4">
                    <span className="text-muted-foreground">Image 3: Home Screen</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Add this site to your home screen for easy access.</p>
                <div className="flex justify-between pt-2"><Button variant="outline" onClick={prev}>Back</Button><Button onClick={next}>Continue</Button></div>
              </div>
            )}

            {step === 8 && (
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold">Done!</h3>
                <p className="text-lg text-muted-foreground">Let's run better with NutriSync.</p>
                <div className="flex justify-center"><Button onClick={()=> onDone ? onDone() : window.location.assign('/')} size="lg">Done</Button></div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
