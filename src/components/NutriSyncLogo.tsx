import React, { useState, useEffect } from 'react';

interface NutriSyncLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function NutriSyncLogo({ size = 'md', className = '' }: NutriSyncLogoProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

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

  useEffect(() => {
    // Preload the image to avoid suspension
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageError(true);
    img.src = '/nutrisync-logo.png';
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Nutrisync PNG Logo */}
      {imageLoaded && !imageError ? (
        <img 
          src="/nutrisync-logo.png" 
          alt="Nutrisync Logo" 
          className={`${sizeClasses[size]} object-contain`}
        />
      ) : (
        // Fallback: Show a colored circle with "N" if image fails to load
        <div className={`${sizeClasses[size]} bg-primary rounded-full flex items-center justify-center`}>
          <span className={`font-bold text-white ${textSizes[size]}`}>N</span>
        </div>
      )}
      
      {/* Nutrisync text */}
      <span className={`font-bold text-white ${textSizes[size]}`}>
        Nutrisync
      </span>
    </div>
  );
}
