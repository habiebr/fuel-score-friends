import { Home, User, Utensils, Users, Activity } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface BottomNavProps {
  onAddMeal?: () => void;
}

export function BottomNav({ onAddMeal }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 safe-area-inset-bottom">
      <div className="max-w-none mx-auto px-2">
        <div className="flex items-center justify-around h-16">
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

          {/* Food */}
          <NavLink
            to="/meals"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Utensils className="h-5 w-5" />
            <span className="text-xs font-medium">Food</span>
          </NavLink>

          {/* Training */}
          <NavLink
            to="/training-calendar"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Activity className="h-5 w-5" />
            <span className="text-xs font-medium">Training</span>
          </NavLink>

          {/* Community */}
          <NavLink
            to="/community"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Users className="h-5 w-5" />
            <span className="text-xs font-medium">Community</span>
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
