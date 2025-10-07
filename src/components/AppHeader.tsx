import React from 'react';

interface AppHeaderProps {
  className?: string;
}

export function AppHeader({ className }: AppHeaderProps) {
  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <img src="/logo.svg" alt="NutriSync" className="w-10 h-10 rounded-xl" />
      <div>
        <h1 className="text-xl font-bold leading-tight">NutriSync</h1>
        <p className="text-sm text-muted-foreground">Fuel Your Run</p>
      </div>
    </div>
  );
}

export default AppHeader;


