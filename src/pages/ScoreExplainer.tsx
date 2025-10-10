import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ListOrdered, Clock, Flame, Dumbbell, Award, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const SCORE_MAX = 100;

const nutritionWeights = [
  { label: 'Macros', value: 50 },
  { label: 'Timing', value: 35 },
  { label: 'Structure', value: 15 },
];

const trainingWeights = [
  { load: 'Rest', nutrition: 100, training: 0 },
  { load: 'Easy', nutrition: 70, training: 30 },
  { load: 'Moderate', nutrition: 60, training: 40 },
  { load: 'Long', nutrition: 55, training: 45 },
  { load: 'Quality', nutrition: 60, training: 40 },
];

const macroTargets = [
  { match: 'Within ±5%', score: 100 },
  { match: 'Within ±10%', score: 60 },
  { match: 'Within ±20%', score: 20 },
  { match: 'More than ±20%', score: 0 },
];

const bonuses = [
  { title: 'Fueling windows', description: 'Meeting pre/during/post-run fueling windows earns up to +10 points.' },
  { title: 'Streaks & consistency', description: 'Long streaks of on-plan days can add small bonuses.' },
  { title: 'Hydration & micronutrients', description: 'Optional metrics can provide a few extra points when enabled.' },
];

const penalties = [
  { title: 'Big caloric deficit', description: 'Falling >15% below target can subtract up to 10 points.' },
  { title: 'Post-run fueling missed', description: 'Skipping recovery fueling on hard days removes 5–10 points.' },
  { title: 'Late logs / incomplete data', description: 'Incomplete meal logging results in partial scores (0–20).' },
];

const DailyScoreExplainer = () => (
  <Card className="shadow-card">
    <CardHeader className="space-y-2">
      <Badge variant="secondary" className="w-fit">Daily Score</Badge>
      <CardTitle className="text-2xl">How we calculate your daily score</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <Alert>
        <Award className="h-4 w-4" />
        <AlertTitle>Target: {SCORE_MAX} points each day</AlertTitle>
        <AlertDescription>
          We combine nutrition ({'~'}60–70% weight) and training ({'~'}30–40% weight) based on your day&apos;s planned load.
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Flame className="h-5 w-5" /> Nutrition ({'~'}60–70% of score)
        </h3>
        <p className="text-sm text-muted-foreground">
          We look at how closely you hit your macro targets, whether you fuel at the right times, and meal structure.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {nutritionWeights.map((item) => (
            <Card key={item.label} className="border-dashed">
              <CardContent className="p-4 space-y-1">
                <div className="text-sm uppercase tracking-wide text-muted-foreground">{item.label}</div>
                <div className="text-3xl font-semibold">{item.value}%</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-2">
            <div className="font-semibold flex items-center gap-2"><Info className="h-4 w-4" /> Macro accuracy scoring</div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              {macroTargets.map((item) => (
                <li key={item.match}><span className="font-medium">{item.match}</span> → {item.score} pts</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Dumbbell className="h-5 w-5" /> Training ({'~'}0–40% of score)
        </h3>
        <p className="text-sm text-muted-foreground">
          We compare your completed session to the planned workout: did you show up, match the type, and hit intensity targets?
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Planned load</th>
                <th className="py-2 pr-4 font-semibold">Nutrition weight</th>
                <th className="py-2 pr-4 font-semibold">Training weight</th>
              </tr>
            </thead>
            <tbody>
              {trainingWeights.map((row) => (
                <tr key={row.load} className="border-t border-border/60">
                  <td className="py-2 pr-4 font-medium">{row.load}</td>
                  <td className="py-2 pr-4">{row.nutrition}%</td>
                  <td className="py-2 pr-4">{row.training}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Separator />

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5" /> Bonuses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {bonuses.map((bonus) => (
              <div key={bonus.title}>
                <span className="font-medium text-foreground">{bonus.title}.</span> {bonus.description}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><ListOrdered className="h-5 w-5" /> Penalties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {penalties.map((penalty) => (
              <div key={penalty.title}>
                <span className="font-medium text-foreground">{penalty.title}.</span> {penalty.description}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </CardContent>
  </Card>
);

const WeeklyScoreExplainer = () => (
  <Card className="shadow-card">
    <CardHeader className="space-y-2">
      <Badge variant="secondary" className="w-fit">Weekly Score</Badge>
      <CardTitle className="text-2xl">How the weekly score rolls up</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>7-day moving average</AlertTitle>
        <AlertDescription>
          We average your valid daily scores from Monday through Sunday. Missing or zero-score days do not count toward the denominator.
        </AlertDescription>
      </Alert>

      <section className="space-y-3 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Step 1.</span> Calculate each day&apos;s unified score using the nutrition, training, bonus, and penalty rules above.
        </p>
        <p>
          <span className="font-medium text-foreground">Step 2.</span> Keep only days with a score greater than zero (days with no logging are ignored).
        </p>
        <p>
          <span className="font-medium text-foreground">Step 3.</span> Average those daily scores and round to the nearest whole number for leaderboards and widgets.
        </p>
      </section>

      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-2">
          <div className="font-semibold flex items-center gap-2"><Info className="h-4 w-4" /> Example</div>
          <p className="text-sm text-muted-foreground">
            Suppose you have valid scores on five days this week: 82, 75, 90, 88, and 80. We average those (83 in this case) and display <strong>83</strong> as your weekly score.
          </p>
        </CardContent>
      </Card>
    </CardContent>
  </Card>
);

export default function ScoreExplainerPage() {
  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Understanding your scores</h1>
          <p className="text-muted-foreground">
            Our unified scoring system keeps runners accountable to both fueling and training. This page breaks down the ingredients that go into your daily and weekly numbers.
          </p>
        </div>

        <ScrollArea className="h-full">
          <div className="space-y-10 pb-16">
            <DailyScoreExplainer />
            <WeeklyScoreExplainer />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
