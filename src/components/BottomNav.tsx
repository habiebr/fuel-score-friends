import { Home, User, Camera, Target, Utensils } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface BottomNavProps {
  onAddMeal?: () => void;
}

export function BottomNav({ onAddMeal }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="max-w-7xl mx-auto px-2">
        <div className="flex items-center justify-around h-16 relative">
          {/* Home */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </NavLink>

          {/* Goals */}
          <NavLink
            to="/goals"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Target className="h-5 w-5" />
            <span className="text-xs font-medium">Goals</span>
          </NavLink>

          {/* Center Add Meal Button */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-6">
            <Button
              size="lg"
              onClick={onAddMeal}
              className="h-14 w-14 rounded-full shadow-elegant animate-pulse-glow"
            >
              <Camera className="h-6 w-6" />
            </Button>
          </div>

          {/* Meals */}
          <NavLink
            to="/meals"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Utensils className="h-5 w-5" />
            <span className="text-xs font-medium">Meals</span>
          </NavLink>

          {/* Profile */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
