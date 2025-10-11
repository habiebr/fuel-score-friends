import { Home, User, Utensils, Users, Activity } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onAddMeal?: () => void;
}

const baseLinkStyles =
  "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl text-xs font-medium transition-all duration-200";
const activeLinkStyles =
  "text-primary bg-primary/10 shadow-[0_12px_28px_rgba(49,255,176,0.25)]";
const inactiveLinkStyles =
  "text-muted-foreground hover:text-foreground hover:bg-muted/30";

export function BottomNav({ onAddMeal: _onAddMeal }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] safe-area-inset-bottom pb-4 animate-slide-up">
      <div className="max-w-none mx-auto px-4">
        <div className="flex items-center justify-around rounded-3xl border border-border/80 bg-background/90 backdrop-blur-xl shadow-[0_-18px_45px_rgba(5,10,20,0.85)] py-3">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn(
                baseLinkStyles,
                isActive ? activeLinkStyles : inactiveLinkStyles,
              )
            }
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/meals"
            className={({ isActive }) =>
              cn(
                baseLinkStyles,
                isActive ? activeLinkStyles : inactiveLinkStyles,
              )
            }
          >
            <Utensils className="h-5 w-5" />
            <span>Food</span>
          </NavLink>

          <NavLink
            to="/training-calendar"
            className={({ isActive }) =>
              cn(
                baseLinkStyles,
                isActive ? activeLinkStyles : inactiveLinkStyles,
              )
            }
          >
            <Activity className="h-5 w-5" />
            <span>Training</span>
          </NavLink>

          <NavLink
            to="/community"
            className={({ isActive }) =>
              cn(
                baseLinkStyles,
                isActive ? activeLinkStyles : inactiveLinkStyles,
              )
            }
          >
            <Users className="h-5 w-5" />
            <span>Community</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                baseLinkStyles,
                isActive ? activeLinkStyles : inactiveLinkStyles,
              )
            }
          >
            <User className="h-5 w-5" />
            <span>Profile</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
