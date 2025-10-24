import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Star, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PerformanceTierBadgeProps {
  tier: 'learner' | 'athlete' | 'elite';
  progressToNext?: number;
  daysToNextTier?: number;
  avg28d?: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PerformanceTierBadge({
  tier,
  progressToNext = 0,
  daysToNextTier = 0,
  avg28d = 0,
  showProgress = false,
  size = 'md',
  className
}: PerformanceTierBadgeProps) {
  
  const getTierConfig = () => {
    switch (tier) {
      case 'learner':
        return {
          label: 'Learner',
          icon: Star,
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          iconColor: 'text-blue-600',
          nextTier: 'Athlete',
          threshold: 60
        };
      case 'athlete':
        return {
          label: 'Athlete',
          icon: Trophy,
          color: 'bg-green-100 text-green-800 border-green-200',
          iconColor: 'text-green-600',
          nextTier: 'Elite',
          threshold: 80
        };
      case 'elite':
        return {
          label: 'Elite',
          icon: Crown,
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          iconColor: 'text-purple-600',
          nextTier: null,
          threshold: 90
        };
      default:
        return {
          label: 'Learner',
          icon: Star,
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          iconColor: 'text-blue-600',
          nextTier: 'Athlete',
          threshold: 60
        };
    }
  };

  const config = getTierConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Badge 
        variant="outline" 
        className={cn(
          'flex items-center gap-2 font-semibold',
          config.color,
          sizeClasses[size]
        )}
      >
        <Icon className={cn(config.iconColor, iconSizeClasses[size])} />
        {config.label}
      </Badge>
      
      {showProgress && config.nextTier && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress to {config.nextTier}</span>
            <span>{Math.round(progressToNext)}%</span>
          </div>
          <Progress 
            value={progressToNext} 
            className="h-2"
          />
          {daysToNextTier > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              ~{daysToNextTier} days to {config.nextTier}
            </p>
          )}
        </div>
      )}
      
      {avg28d > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          28-day avg: {avg28d.toFixed(1)}
        </div>
      )}
    </div>
  );
}


