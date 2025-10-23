import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeeklyInsightCardProps {
  weekStart: string;
  avgFuelScore: number;
  preOk: number;
  duringOk: number;
  postOk: number;
  impact?: {
    endurance_pct?: number;
    recovery_days_saved?: number;
    performance_boost?: number;
  };
  className?: string;
}

export function WeeklyInsightCard({
  weekStart,
  avgFuelScore,
  preOk,
  duringOk,
  postOk,
  impact,
  className
}: WeeklyInsightCardProps) {
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Week of {weekStart}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Average Fuel Score */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Average Fuel Score</span>
          </div>
          <Badge variant={getScoreBadgeVariant(avgFuelScore)}>
            {avgFuelScore.toFixed(1)}
          </Badge>
        </div>

        {/* Fueling Windows */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Fueling Windows</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Pre-Run</div>
              <div className={cn('font-semibold', getScoreColor(preOk))}>
                {preOk.toFixed(0)}%
              </div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">During</div>
              <div className={cn('font-semibold', getScoreColor(duringOk))}>
                {duringOk.toFixed(0)}%
              </div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Post-Run</div>
              <div className={cn('font-semibold', getScoreColor(postOk))}>
                {postOk.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Impact Metrics */}
        {impact && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Performance Impact
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {impact.endurance_pct && (
                <div className="flex justify-between items-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <span className="text-sm">Endurance Boost</span>
                  <span className="font-semibold text-green-600">
                    +{impact.endurance_pct.toFixed(1)}%
                  </span>
                </div>
              )}
              {impact.recovery_days_saved && (
                <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <span className="text-sm">Recovery Time Saved</span>
                  <span className="font-semibold text-blue-600">
                    {impact.recovery_days_saved.toFixed(1)} days
                  </span>
                </div>
              )}
              {impact.performance_boost && (
                <div className="flex justify-between items-center p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <span className="text-sm">Performance Boost</span>
                  <span className="font-semibold text-purple-600">
                    +{impact.performance_boost.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

