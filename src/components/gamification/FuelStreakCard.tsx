import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Flame, Target, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatStreakText, getTierDisplay } from '@/utils/gamification';

interface FuelStreakCardProps {
  todayScore: number;
  currentStreak: number;
  bestStreak: number;
  tier?: 'learner' | 'athlete' | 'elite';
  onKeepStreak?: () => void;
  showAnimation?: boolean;
  className?: string;
}

export function FuelStreakCard({
  todayScore,
  currentStreak,
  bestStreak,
  tier = 'learner',
  onKeepStreak,
  showAnimation = false,
  className
}: FuelStreakCardProps) {
  const STREAK_THRESHOLD = 70;
  const isGoodDay = todayScore >= STREAK_THRESHOLD;
  const scoreProgress = Math.min(100, (todayScore / 100) * 100);
  
  // Animation classes
  const streakAnimation = showAnimation && isGoodDay ? 'animate-pulse' : '';
  const fireAnimation = currentStreak >= 7 ? 'animate-bounce' : '';
  
  // Color scheme based on score
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };
  
  const getScoreBgColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-50 dark:bg-emerald-950/20';
    if (score >= 70) return 'bg-green-50 dark:bg-green-950/20';
    if (score >= 50) return 'bg-yellow-50 dark:bg-yellow-950/20';
    return 'bg-red-50 dark:bg-red-950/20';
  };

  return (
    <TooltipProvider>
      <Card className={cn(
        'relative overflow-hidden transition-all duration-300 hover:shadow-lg',
        getScoreBgColor(todayScore),
        className
      )}>
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Fuel Score Hari Ini</h3>
            </div>
            {tier && (
              <Badge variant="secondary" className="text-xs">
                {getTierDisplay(tier).name}
              </Badge>
            )}
          </div>

          {/* Score Display - Hidden to avoid redundancy */}
          {/* <div className="text-center mb-6">
            <div className={cn(
              'text-5xl font-bold transition-colors duration-300',
              getScoreColor(todayScore),
              streakAnimation
            )}>
              {Math.round(todayScore)}
            </div>
            <div className="mt-2">
              <Progress 
                value={scoreProgress} 
                className={cn('h-2', getScoreColor(todayScore).replace('text-', 'bg-'))}
              />
            </div>
          </div> */}

          {/* Streak Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className={cn('h-4 w-4 text-orange-500', fireAnimation)} />
                <span className="text-sm font-medium">Current Streak</span>
              </div>
              <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {currentStreak} hari
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Best Streak</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {bestStreak} hari
              </span>
            </div>
          </div>

          {/* Status Message */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              {isGoodDay ? (
                <>
                  <Zap className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Mantap! Pertahankan ≥70 untuk lanjutkan streak.
                  </span>
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-700 dark:text-orange-300">
                    Ayo kejar target ≥70 hari ini ✊
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Button */}
          {onKeepStreak && (
            <div className="mt-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={onKeepStreak}
                    className="w-full"
                    variant={isGoodDay ? "default" : "outline"}
                    size="sm"
                  >
                    {isGoodDay ? 'Pertahankan Streak' : 'Mulai Streak'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{formatStreakText(currentStreak)}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Streak Milestone Progress */}
          {currentStreak > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Milestone Progress</span>
                <span>{currentStreak}/45</span>
              </div>
              <div className="flex gap-1">
                {[7, 21, 45].map((milestone) => (
                  <div
                    key={milestone}
                    className={cn(
                      'h-2 flex-1 rounded-full transition-colors',
                      currentStreak >= milestone
                        ? 'bg-green-500'
                        : currentStreak >= milestone * 0.8
                        ? 'bg-yellow-500'
                        : 'bg-muted'
                    )}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>D7</span>
                <span>D21</span>
                <span>D45</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
