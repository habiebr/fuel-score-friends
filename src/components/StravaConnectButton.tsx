import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Strava Connect Button Component
 * 
 * Follows official Strava brand guidelines:
 * - Orange brand color: #FC5200
 * - Button height: 48px @1x, 96px @2x
 * - Links to https://www.strava.com/oauth/authorize
 * 
 * Reference: https://developers.strava.com/guidelines/
 */

interface StravaConnectButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'orange' | 'white';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function StravaConnectButton({ 
  onClick, 
  disabled = false,
  variant = 'orange',
  size = 'default',
  className 
}: StravaConnectButtonProps) {
  
  const heights = {
    sm: 'h-10', // 40px
    default: 'h-12', // 48px - official Strava height
    lg: 'h-14' // 56px
  };

  const textSizes = {
    sm: 'text-sm',
    default: 'text-base',
    lg: 'text-lg'
  };

  const isOrange = variant === 'orange';
  
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        heights[size],
        'px-6 font-semibold rounded-md transition-all duration-200',
        'flex items-center gap-3',
        isOrange 
          ? 'bg-[#FC5200] hover:bg-[#E04A00] text-white shadow-md hover:shadow-lg' 
          : 'bg-white hover:bg-gray-50 text-[#FC5200] border-2 border-[#FC5200]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Strava Logo SVG - Official brand mark */}
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        className={cn(
          'flex-shrink-0',
          size === 'sm' && 'w-5 h-5',
          size === 'lg' && 'w-7 h-7'
        )}
      >
        <path 
          d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" 
          fill={isOrange ? 'white' : '#FC5200'}
        />
      </svg>
      
      <span className={cn('font-bold', textSizes[size])}>
        Connect with Strava
      </span>
    </Button>
  );
}

interface StravaDisconnectButtonProps {
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function StravaDisconnectButton({ 
  onClick, 
  disabled = false,
  size = 'default',
  className 
}: StravaDisconnectButtonProps) {
  const heights = {
    sm: 'h-10',
    default: 'h-12',
    lg: 'h-14'
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="destructive"
      className={cn(
        heights[size],
        'px-6',
        className
      )}
    >
      Disconnect
    </Button>
  );
}

interface StravaBadgeProps {
  variant?: 'powered' | 'compatible';
  color?: 'orange' | 'white' | 'black';
  className?: string;
}

/**
 * Strava Badge Component
 * 
 * Shows "Powered by Strava" or "Compatible with Strava" badge
 * Following official Strava brand guidelines
 */
export function StravaBadge({ 
  variant = 'powered', 
  color = 'orange',
  className 
}: StravaBadgeProps) {
  const text = variant === 'powered' ? 'Powered by' : 'Compatible with';
  
  const colors = {
    orange: 'text-[#FC5200]',
    white: 'text-white',
    black: 'text-black'
  };

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <span className={cn('font-medium', colors[color])}>
        {text}
      </span>
      <svg 
        width="60" 
        height="16" 
        viewBox="0 0 60 16" 
        fill="none"
      >
        <path 
          d="M7.6 7.2l1.4 2.8h2l-2.6-5.2L5.8 0 0 13h2l1.4-2.8m8.2 0L17.2 13h2L13.4 0l-2.6 5.2h2" 
          fill={color === 'orange' ? '#FC5200' : color === 'white' ? 'white' : 'black'}
        />
      </svg>
    </div>
  );
}
