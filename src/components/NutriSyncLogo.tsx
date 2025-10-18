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
      {/* Apple icon with DNA helix */}
      <div className={`${sizeClasses[size]} relative`}>
        <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-400 rounded-full shadow-lg">
          {/* DNA helix symbol - more accurate double helix */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg 
              viewBox="0 0 24 24" 
              className="w-3/4 h-3/4 text-white"
              fill="currentColor"
            >
              {/* Double helix DNA representation */}
              <path d="M8 4C8 2.9 8.9 2 10 2H14C15.1 2 16 2.9 16 4V6C16 7.1 15.1 8 14 8H10C8.9 8 8 7.1 8 6V4Z" />
              <path d="M8 10C8 8.9 8.9 8 10 8H14C15.1 8 16 8.9 16 10V12C16 13.1 15.1 14 14 14H10C8.9 14 8 13.1 8 12V10Z" />
              <path d="M8 16C8 14.9 8.9 14 10 14H14C15.1 14 16 14.9 16 16V18C16 19.1 15.1 20 14 20H10C8.9 20 8 19.1 8 18V16Z" />
              <path d="M8 20C8 18.9 8.9 18 10 18H14C15.1 18 16 18.9 16 20V22C16 23.1 15.1 24 14 24H10C8.9 24 8 23.1 8 22V20Z" />
            </svg>
          </div>
          {/* Apple stem with leaves */}
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
            <div className="w-1 h-2 bg-green-700 rounded-full"></div>
            <div className="absolute -top-1 -left-1 w-1 h-1 bg-green-700 rounded-full transform rotate-45"></div>
            <div className="absolute -top-1 -right-1 w-1 h-1 bg-green-700 rounded-full transform -rotate-45"></div>
          </div>
        </div>
      </div>
      
      {/* NutriSync text */}
      <span className={`font-bold text-white ${textSizes[size]}`}>
        NutriSync
      </span>
    </div>
  );
}
