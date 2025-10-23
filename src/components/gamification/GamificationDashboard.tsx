import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  TrendingUp, 
  Calendar,
  Target,
  Zap,
  Activity,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FuelStreakCard } from './FuelStreakCard';
import { WeeklyInsightCard } from './WeeklyInsightCard';
import { PerformanceTierBadge } from './PerformanceTierBadge';
import { MilestoneModal } from './MilestoneModal';

interface GamificationDashboardProps {
  // Current state
  todayScore: number;
  currentStreak: number;
  bestStreak: number;
  tier: 'learner' | 'athlete' | 'elite';
  avg28d: number;
  
  // Weekly insights
  weeklyInsight?: {
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
  };
  
  // Milestones
  achievedMilestones: string[];
  pendingMilestone?: string;
  
  // Actions
  onKeepStreak?: () => void;
  onViewWeeklyDetails?: () => void;
  onShareMilestone?: () => void;
  onAcknowledgeMilestone?: (milestone: string) => void;
  className?: string;
}

export function GamificationDashboard({
  todayScore,
  currentStreak,
  bestStreak,
  tier,
  avg28d,
  weeklyInsight,
  achievedMilestones,
  pendingMilestone,
  onKeepStreak,
  onViewWeeklyDetails,
  onShareMilestone,
  onAcknowledgeMilestone,
  className
}: GamificationDashboardProps) {
  const [showMilestoneModal, setShowMilestoneModal] = React.useState(false);
  
  // Show milestone modal if there's a pending milestone
  React.useEffect(() => {
    if (pendingMilestone && !achievedMilestones.includes(pendingMilestone)) {
      setShowMilestoneModal(true);
    }
  }, [pendingMilestone, achievedMilestones]);
  
  const handleMilestoneClose = () => {
    setShowMilestoneModal(false);
    if (pendingMilestone && onAcknowledgeMilestone) {
      onAcknowledgeMilestone(pendingMilestone);
    }
  };
  
  const getProgressToNextTier = () => {
    switch (tier) {
      case 'learner': return Math.min(100, (avg28d / 70) * 100);
      case 'athlete': return Math.min(100, ((avg28d - 70) / (85 - 70)) * 100);
      default: return 100;
    }
  };
  
  const getDaysToNextTier = () => {
    // Simplified calculation - in real app, this would be more sophisticated
    const currentThreshold = tier === 'learner' ? 70 : tier === 'athlete' ? 85 : 100;
    const nextThreshold = tier === 'learner' ? 85 : tier === 'athlete' ? 100 : 100;
    
    if (avg28d >= nextThreshold) return 0;
    
    const pointsNeeded = nextThreshold - avg28d;
    const dailyImprovement = 0.5; // Assume 0.5 points improvement per day
    return Math.ceil(pointsNeeded / dailyImprovement);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Milestone Modal */}
      {pendingMilestone && (
        <MilestoneModal
          milestone={pendingMilestone as any}
          isOpen={showMilestoneModal}
          onClose={handleMilestoneClose}
          onShare={onShareMilestone}
          currentStreak={currentStreak}
        />
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fuel Dashboard</h2>
          <p className="text-muted-foreground">
            Track your nutrition journey and achievements
          </p>
        </div>
        
        <PerformanceTierBadge
          tier={tier}
          progressToNext={getProgressToNextTier()}
          daysToNextTier={getDaysToNextTier()}
          avg28d={avg28d}
          showProgress={true}
          size="lg"
        />
      </div>
      
      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FuelStreakCard
              todayScore={todayScore}
              currentStreak={currentStreak}
              bestStreak={bestStreak}
              tier={tier}
              onKeepStreak={onKeepStreak}
              showAnimation={true}
            />
            
            <WeeklyInsightCard
              insight={weeklyInsight}
              onViewDetails={onViewWeeklyDetails}
            />
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{currentStreak}</div>
                <div className="text-sm text-muted-foreground">Current Streak</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{bestStreak}</div>
                <div className="text-sm text-muted-foreground">Best Streak</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{avg28d.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">28d Average</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{achievedMilestones.length}</div>
                <div className="text-sm text-muted-foreground">Milestones</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-semibold">Tier Progress</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Current: {tier}</span>
                      <span>{avg28d.toFixed(1)}/100</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getProgressToNextTier()}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getDaysToNextTier()} days to next tier
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold">Streak Analysis</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Current streak:</span>
                      <span className="font-medium">{currentStreak} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Best streak:</span>
                      <span className="font-medium">{bestStreak} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Consistency:</span>
                      <span className="font-medium">
                        {bestStreak > 0 ? Math.round((currentStreak / bestStreak) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {['D7', 'D21', 'D45'].map((milestone) => {
                  const isAchieved = achievedMilestones.includes(milestone);
                  const isPending = milestone === pendingMilestone;
                  
                  return (
                    <div
                      key={milestone}
                      className={cn(
                        'p-4 rounded-lg border-2 text-center transition-all duration-300',
                        isAchieved 
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                          : isPending
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                          : 'border-muted bg-muted/50'
                      )}
                    >
                      <div className="text-2xl mb-2">
                        {milestone === 'D7' ? '🏆' : milestone === 'D21' ? '👑' : '⭐'}
                      </div>
                      <div className="font-semibold">{milestone}</div>
                      <div className="text-sm text-muted-foreground">
                        {milestone === 'D7' ? '7 days streak' : 
                         milestone === 'D21' ? '21 days streak' : '45 days streak'}
                      </div>
                      {isAchieved && (
                        <Badge className="mt-2" variant="secondary">
                          Achieved
                        </Badge>
                      )}
                      {isPending && (
                        <Badge className="mt-2" variant="default">
                          New!
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

