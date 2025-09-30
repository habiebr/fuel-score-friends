import { Home, User, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-around h-16 relative">
          {/* Home */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Home className="h-6 w-6" />
            <span className="text-xs font-medium">Home</span>
          </NavLink>

          {/* Center Record Button */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-6">
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-elegant"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>

          {/* Profile */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <User className="h-6 w-6" />
            <span className="text-xs font-medium">Profile</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
