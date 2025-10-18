import React from 'react';

interface NutriSyncLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function NutriSyncLogo({ size = 'md', className = '' }: NutriSyncLogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl', 
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* NutriSync PNG Logo */}
      <img 
        src="/logo-source.png" 
        alt="NutriSync Logo" 
        className={`${sizeClasses[size]} object-contain`}
      />
      
      {/* NutriSync text */}
      <span className={`font-bold text-white ${textSizes[size]}`}>
        NutriSync
      </span>
    </div>
  );
}
