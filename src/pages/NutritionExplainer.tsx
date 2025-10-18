import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calculator, Activity, Flame, Scale, TrendingUp, Utensils, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const BMRExplainer = () => (
  <Card className="shadow-card">
    <CardHeader className="space-y-2">
      <Badge variant="secondary" className="w-fit">Step 1: BMR</Badge>
      <CardTitle className="text-2xl">Basal Metabolic Rate (BMR)</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <Alert>
        <Flame className="h-4 w-4" />
        <AlertTitle>What is BMR?</AlertTitle>
        <AlertDescription>
          BMR is the number of calories your body burns at rest just to maintain basic functions like breathing, circulation, and cell production.
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Calculator className="h-5 w-5" /> Calculation Method
        </h3>
        <p className="text-sm text-muted-foreground">
          We use the <strong>Mifflin-St Jeor Equation</strong>, which is one of the most accurate formulas for estimating BMR.
        </p>
        
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-3">
            <div className="font-semibold">For Men:</div>
            <code className="text-sm block p-3 bg-background rounded">
              BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) + 5
            </code>
            
            <div className="font-semibold mt-4">For Women:</div>
            <code className="text-sm block p-3 bg-background rounded">
              BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) - 161
            </code>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="font-semibold flex items-center gap-2 text-primary mb-2">
              <Info className="h-4 w-4" /> Example
            </div>
            <p className="text-sm text-muted-foreground">
              A 30-year-old male weighing 70 kg and 175 cm tall:<br/>
              BMR = (10 × 70) + (6.25 × 175) - (5 × 30) + 5<br/>
              BMR = 700 + 1,093.75 - 150 + 5 = <strong className="text-primary">1,648.75 kcal/day</strong>
            </p>
          </CardContent>
        </Card>
      </section>
    </CardContent>
  </Card>
);

const TDEEExplainer = () => (
  <Card className="shadow-card">
    <CardHeader className="space-y-2">
      <Badge variant="secondary" className="w-fit">Step 2: TDEE</Badge>
      <CardTitle className="text-2xl">Total Daily Energy Expenditure (TDEE)</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>What is TDEE?</AlertTitle>
        <AlertDescription>
          TDEE is your total calorie burn for the day, including your BMR plus all physical activity (exercise, walking, daily movement).
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> Calculation
        </h3>
        <p className="text-sm text-muted-foreground">
          We multiply your BMR by an <strong>activity multiplier</strong> based on your training load:
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-3 pr-4 font-semibold">Training Load</th>
                <th className="py-3 pr-4 font-semibold">Activity Multiplier</th>
                <th className="py-3 pr-4 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60">
                <td className="py-3 pr-4 font-medium">Rest</td>
                <td className="py-3 pr-4">1.3</td>
                <td className="py-3 pr-4 text-muted-foreground">No training planned</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-3 pr-4 font-medium">Easy</td>
                <td className="py-3 pr-4">1.5</td>
                <td className="py-3 pr-4 text-muted-foreground">Light run (&lt;8 km or &lt;45 min)</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-3 pr-4 font-medium">Moderate</td>
                <td className="py-3 pr-4">1.6</td>
                <td className="py-3 pr-4 text-muted-foreground">Medium run (8-15 km or 45-90 min)</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-3 pr-4 font-medium">Long</td>
                <td className="py-3 pr-4">1.8</td>
                <td className="py-3 pr-4 text-muted-foreground">Long run (&gt;15 km or &gt;90 min)</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-3 pr-4 font-medium">Quality</td>
                <td className="py-3 pr-4">1.7</td>
                <td className="py-3 pr-4 text-muted-foreground">Intense workout (tempo, intervals, hills)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="font-semibold mb-2">Formula:</div>
            <code className="text-sm block p-3 bg-background rounded">
              TDEE = BMR × Activity Multiplier
            </code>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="font-semibold flex items-center gap-2 text-primary mb-2">
              <Info className="h-4 w-4" /> Example
            </div>
            <p className="text-sm text-muted-foreground">
              Using our example runner with BMR of 1,649 kcal:<br/>
              <strong>Easy Run Day:</strong> TDEE = 1,649 × 1.5 = <strong className="text-primary">2,473 kcal</strong><br/>
              <strong>Long Run Day:</strong> TDEE = 1,649 × 1.8 = <strong className="text-primary">2,968 kcal</strong>
            </p>
          </CardContent>
        </Card>
      </section>
    </CardContent>
  </Card>
);

const MacrosExplainer = () => (
  <Card className="shadow-card">
    <CardHeader className="space-y-2">
      <Badge variant="secondary" className="w-fit">Step 3: Macros</Badge>
      <CardTitle className="text-2xl">Macronutrient Distribution</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <Alert>
        <Scale className="h-4 w-4" />
        <AlertTitle>What are Macros?</AlertTitle>
        <AlertDescription>
          Macronutrients (carbs, protein, fat) are the nutrients your body needs in large amounts. Each plays a unique role in fueling and recovery.
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Utensils className="h-5 w-5" /> Runner-Optimized Distribution
        </h3>
        <p className="text-sm text-muted-foreground">
          Our system uses a <strong>runner-focused strategy</strong> that prioritizes carbohydrates for energy while ensuring adequate protein for recovery and healthy fats.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2 border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-4 space-y-2">
              <div className="text-4xl font-bold text-orange-500">50%</div>
              <div className="font-semibold">Carbohydrates</div>
              <div className="text-xs text-muted-foreground">
                Primary energy source for running. Essential for glycogen storage and endurance.
              </div>
              <div className="text-xs font-mono mt-2">
                = TDEE × 0.50 ÷ 4 kcal/g
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 space-y-2">
              <div className="text-4xl font-bold text-blue-500">25%</div>
              <div className="font-semibold">Protein</div>
              <div className="text-xs text-muted-foreground">
                Builds and repairs muscle tissue. Critical for recovery after training.
              </div>
              <div className="text-xs font-mono mt-2">
                = TDEE × 0.25 ÷ 4 kcal/g
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-4 space-y-2">
              <div className="text-4xl font-bold text-purple-500">25%</div>
              <div className="font-semibold">Fat</div>
              <div className="text-xs text-muted-foreground">
                Supports hormone production, vitamin absorption, and long-duration energy.
              </div>
              <div className="text-xs font-mono mt-2">
                = TDEE × 0.25 ÷ 9 kcal/g
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="font-semibold flex items-center gap-2 text-primary mb-2">
              <Info className="h-4 w-4" /> Example (Easy Run Day)
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              TDEE = 2,473 kcal (from above)
            </p>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between p-2 bg-orange-500/10 rounded">
                <span>Carbs (50%):</span>
                <span className="font-mono">(2,473 × 0.50) ÷ 4 = <strong>309g</strong></span>
              </div>
              <div className="flex justify-between p-2 bg-blue-500/10 rounded">
                <span>Protein (25%):</span>
                <span className="font-mono">(2,473 × 0.25) ÷ 4 = <strong>154g</strong></span>
              </div>
              <div className="flex justify-between p-2 bg-purple-500/10 rounded">
                <span>Fat (25%):</span>
                <span className="font-mono">(2,473 × 0.25) ÷ 9 = <strong>69g</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </CardContent>
  </Card>
);

const MealDistributionExplainer = () => (
  <Card className="shadow-card">
    <CardHeader className="space-y-2">
      <Badge variant="secondary" className="w-fit">Step 4: Meal Distribution</Badge>
      <CardTitle className="text-2xl">Distributing Across Meals</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <Alert>
        <Utensils className="h-4 w-4" />
        <AlertTitle>Meal Timing Matters</AlertTitle>
        <AlertDescription>
          We distribute your daily calories and macros across breakfast, lunch, dinner, and (on training days) snacks to optimize energy and recovery.
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h3 className="font-semibold text-lg">Standard Distribution</h3>
        
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">🌅 Breakfast</span>
                <Badge variant="secondary">30%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Kickstart your metabolism and fuel morning activities.
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">🌞 Lunch</span>
                <Badge variant="secondary">40%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Largest meal to sustain energy through the afternoon.
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">🌙 Dinner</span>
                <Badge variant="secondary">30%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Recovery and repair while you sleep.
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">🏃 Snack (Training Days)</span>
                <Badge variant="secondary">10%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Pre/post-run fueling for optimal performance.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="font-semibold text-lg">Fueling Windows</h3>
        <p className="text-sm text-muted-foreground">
          For runs longer than 60 minutes, we add specific fueling targets:
        </p>

        <div className="space-y-2 text-sm">
          <Card className="bg-muted/20">
            <CardContent className="p-3">
              <div className="font-semibold mb-1">⏰ Pre-Run (2-3 hours before)</div>
              <p className="text-muted-foreground">1-4g carbs/kg body weight to top off glycogen stores</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/20">
            <CardContent className="p-3">
              <div className="font-semibold mb-1">💧 During-Run (for runs &gt;90 min)</div>
              <p className="text-muted-foreground">30-90g carbs/hour to maintain blood glucose</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/20">
            <CardContent className="p-3">
              <div className="font-semibold mb-1">🔄 Post-Run (within 30-60 min)</div>
              <p className="text-muted-foreground">1-1.2g carbs/kg + 0.3g protein/kg for rapid recovery</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </CardContent>
  </Card>
);

export default function NutritionExplainerPage() {
  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-none mx-auto px-4 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">How We Calculate Your Nutrition Plan</h1>
          <p className="text-muted-foreground">
            Our smart meal planner uses science-based formulas to create personalized daily nutrition targets based on your body composition and training schedule.
          </p>
        </div>

        <ScrollArea className="h-full">
          <div className="space-y-6">
            <BMRExplainer />
            <TDEEExplainer />
            <MacrosExplainer />
            <MealDistributionExplainer />

            <Card className="bg-gradient-to-r from-primary/10 to-amber-500/10 border-primary/20">
              <CardContent className="p-6 space-y-3">
                <div className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Automatic Daily Generation
                </div>
                <p className="text-sm text-muted-foreground">
                  Your meal plan is automatically generated every day at midnight based on your current profile and training schedule. The system:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Recalculates your BMR based on your latest weight and profile data</li>
                  <li>Adjusts your TDEE based on the day's training load</li>
                  <li>Distributes calories and macros optimally across meals</li>
                  <li>Generates smart Indonesian meal suggestions</li>
                  <li>Adds fueling window targets for long runs and quality sessions</li>
                </ul>
                <p className="text-sm font-medium text-primary mt-3">
                  💡 Update your profile regularly for the most accurate meal plans!
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
