import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Crown, 
  Star, 
  Share2, 
  X,
  Flame,
  Target,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MilestoneCode } from '@/utils/gamification';

interface MilestoneModalProps {
  milestone: MilestoneCode;
  isOpen: boolean;
  onClose: () => void;
  onShare?: () => void;
  currentStreak: number;
  className?: string;
}

const milestoneData = {
  D7: {
    title: 'Week Warrior',
    description: '7 hari streak! Kamu sudah membangun kebiasaan yang konsisten.',
    icon: Trophy,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
    borderColor: 'border-yellow-500',
    rewards: ['Streak bonus +2 poin', 'Week Warrior badge'],
    nextTarget: 'D21 (21 hari)'
  },
  D21: {
    title: 'Monthly Master',
    description: '21 hari streak! Kamu sudah menguasai rutinitas nutrisi yang optimal.',
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    borderColor: 'border-purple-500',
    rewards: ['Streak bonus +5 poin', 'Monthly Master badge', 'Tier boost'],
    nextTarget: 'D45 (45 hari)'
  },
  D45: {
    title: 'Century Champion',
    description: '45 hari streak! Kamu adalah champion dalam konsistensi nutrisi.',
    icon: Star,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
    borderColor: 'border-emerald-500',
    rewards: ['Streak bonus +10 poin', 'Century Champion badge', 'Elite tier unlock'],
    nextTarget: 'D100 (100 hari)'
  }
};

export function MilestoneModal({
  milestone,
  isOpen,
  onClose,
  onShare,
  currentStreak,
  className
}: MilestoneModalProps) {
  const data = milestoneData[milestone];
  const Icon = data.icon;
  
  // Confetti effect (simplified)
  const showConfetti = isOpen;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        'sm:max-w-md overflow-hidden',
        data.bgColor,
        className
      )}>
        {/* Confetti Effect */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'absolute w-2 h-2 rounded-full animate-ping',
                  i % 4 === 0 ? 'bg-yellow-400' :
                  i % 4 === 1 ? 'bg-red-400' :
                  i % 4 === 2 ? 'bg-blue-400' : 'bg-green-400'
                )}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        )}
        
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto mb-4 relative">
            <div className={cn(
              'w-20 h-20 rounded-full border-4 flex items-center justify-center',
              data.borderColor,
              'bg-white dark:bg-gray-900'
            )}>
              <Icon className={cn('h-10 w-10', data.color)} />
            </div>
            
            {/* Streak counter */}
            <div className="absolute -top-2 -right-2">
              <Badge className="bg-orange-500 text-white text-xs">
                <Flame className="h-3 w-3 mr-1" />
                {currentStreak}
              </Badge>
            </div>
          </div>
          
          <DialogTitle className="text-2xl font-bold">
            🎉 {data.title} 🎉
          </DialogTitle>
          
          <p className="text-muted-foreground mt-2">
            {data.description}
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Rewards */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-600" />
              Rewards Unlocked
            </h4>
            <div className="space-y-1">
              {data.rewards.map((reward, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>{reward}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Next Target */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Next Target:</span>
              <span className="text-blue-600">{data.nextTarget}</span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={onClose}
              className="flex-1"
              variant="outline"
            >
              <X className="h-4 w-4 mr-2" />
              Tutup
            </Button>
            
            {onShare && (
              <Button 
                onClick={onShare}
                className="flex-1"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Bagikan
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact milestone notification
export function MilestoneNotification({
  milestone,
  onDismiss,
  className
}: {
  milestone: MilestoneCode;
  onDismiss: () => void;
  className?: string;
}) {
  const data = milestoneData[milestone];
  const Icon = data.icon;
  
  return (
    <div className={cn(
      'p-4 rounded-lg border-2 shadow-lg',
      data.bgColor,
      data.borderColor,
      className
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-12 h-12 rounded-full border-2 flex items-center justify-center',
          data.borderColor,
          'bg-white dark:bg-gray-900'
        )}>
          <Icon className={cn('h-6 w-6', data.color)} />
        </div>
        
        <div className="flex-1">
          <h3 className="font-bold text-lg">{data.title}</h3>
          <p className="text-sm text-muted-foreground">
            Milestone tercapai!
          </p>
        </div>
        
        <Button
          onClick={onDismiss}
          variant="ghost"
          size="sm"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

