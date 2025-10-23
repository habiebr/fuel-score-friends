import { lazy, Suspense } from 'react';
import { ScoreCardSkeleton, StreakCardSkeleton, WeeklyInsightSkeleton } from '@/components/ui/Skeleton';

// Lazy load gamification components
const FuelStreakCard = lazy(() => import('./gamification/FuelStreakCard').then(module => ({ default: module.FuelStreakCard })));
const WeeklyInsightCard = lazy(() => import('./gamification/WeeklyInsightCard').then(module => ({ default: module.WeeklyInsightCard })));

interface LazyGamificationProps {
  gamificationData: any;
  loading: boolean;
  error: string | null;
  onKeepStreak: () => void;
  onAckMilestone: (milestone: string) => void;
  onDismissMilestone: () => void;
  pendingMilestone: string | null;
}

export function LazyGamificationWidgets({
  gamificationData,
  loading,
  error,
  onKeepStreak,
  onAckMilestone,
  onDismissMilestone,
  pendingMilestone
}: LazyGamificationProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScoreCardSkeleton />
          <ScoreCardSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <StreakCardSkeleton />
          <WeeklyInsightSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScoreCardSkeleton />
          <ScoreCardSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <StreakCardSkeleton />
          <WeeklyInsightSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score Cards - Load immediately */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Suspense fallback={<ScoreCardSkeleton />}>
          <FuelStreakCard
            currentStreak={gamificationData?.state?.current_streak || 0}
            bestStreak={gamificationData?.state?.best_streak || 0}
            tier={gamificationData?.state?.tier || 'bronze'}
            onKeepStreak={onKeepStreak}
            pendingMilestone={pendingMilestone}
            onAckMilestone={onAckMilestone}
            onDismissMilestone={onDismissMilestone}
          />
        </Suspense>
        <Suspense fallback={<ScoreCardSkeleton />}>
          <WeeklyInsightCard
            weeklyInsight={gamificationData?.latestInsight}
            avg28d={gamificationData?.state?.avg_28d || 0}
          />
        </Suspense>
      </div>
    </div>
  );
}

