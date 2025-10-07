import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, ThumbsUp } from 'lucide-react';

interface WeeklyScoreCardProps {
  weeklyScore: number;
  macroBalance: number;
  mealTiming: number;
  message?: string;
}

export function WeeklyScoreCard({ 
  weeklyScore, 
  macroBalance, 
  mealTiming,
  message = "Good consistency, keep it up!"
}: WeeklyScoreCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-transparent to-amber-500/10 opacity-80" />
      <CardContent className="relative p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Weekly Score</h3>
          </div>
          <Badge className="bg-primary/20 text-primary px-3 py-1 text-lg backdrop-blur">
            {weeklyScore}
          </Badge>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Macro Balance */}
          <div className="text-center">
            <div className="mb-1 text-sm text-muted-foreground">
              Macro Balance
            </div>
            <div className="text-3xl font-bold mb-2">{macroBalance}</div>
            <div className="h-2 w-full rounded-full bg-muted/60">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${macroBalance}%` }}
              />
            </div>
          </div>

          {/* Meal Timing */}
          <div className="text-center">
            <div className="mb-1 text-sm text-muted-foreground">
              Meal Timing
            </div>
            <div className="text-3xl font-bold mb-2">{mealTiming}</div>
            <div className="h-2 w-full rounded-full bg-muted/60">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${mealTiming}%` }}
              />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ThumbsUp className="w-4 h-4 text-primary" />
          <span>{message}</span>
        </div>
      </CardContent>
    </Card>
  );
}
