import { useState } from 'react';
import { Plus, X, Utensils, Activity, Bell, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActionFABProps {
  onLogMeal?: () => void;
  onUploadActivity?: () => void;
}

export function ActionFAB({ onLogMeal, onUploadActivity }: ActionFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    {
      icon: Activity,
      label: 'Upload Activity',
      onClick: () => {
        setIsOpen(false);
        if (onUploadActivity) onUploadActivity();
      },
      color: 'from-info to-sky-500'
    },
    {
      icon: Utensils,
      label: 'Log Meal',
      onClick: () => {
        setIsOpen(false);
        if (onLogMeal) onLogMeal();
      },
      color: 'from-primary to-emerald-500'
    },
    {
      icon: Bell,
      label: 'Set Reminder',
      onClick: () => {
        setIsOpen(false);
        navigate('/profile');
      },
      color: 'from-secondary to-blue-500'
    },
    {
      icon: TrendingUp,
      label: 'View Progress',
      onClick: () => {
        setIsOpen(false);
        navigate('/goals');
      },
      color: 'from-purple-500 to-indigo-500'
    }
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* FAB Container */}
      <div className="fixed bottom-20 right-4 z-50 safe-area-inset-bottom">
        {/* Action Buttons */}
        {isOpen && (
          <div className="absolute bottom-20 right-0 flex flex-col-reverse gap-3 animate-in slide-in-from-bottom-5 duration-300">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.label}
                  className="flex items-center gap-3 animate-in slide-in-from-right duration-200"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="rounded-xl border border-border/50 bg-card/80 px-3 py-2 text-sm shadow-card">
                    <span className="font-medium whitespace-nowrap text-foreground">
                      {action.label}
                    </span>
                  </div>
                  <button
                    onClick={action.onClick}
                    className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${action.color} text-primary-foreground shadow-[0_20px_45px_rgba(49,255,176,0.35)] transition-transform active:scale-95`}
                  >
                    <Icon className="w-6 h-6" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-500 text-primary-foreground shadow-[0_24px_55px_rgba(49,255,176,0.4)] transition-all duration-300 touch-manipulation active:scale-95 ${
            isOpen ? 'rotate-45' : ''
          }`}
          aria-label={isOpen ? 'Close menu' : 'Open actions menu'}
        >
          {isOpen ? (
            <X className="w-8 h-8" />
          ) : (
            <>
              <Plus className="w-8 h-8" />
              {/* Pulse animation ring */}
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-sky-500 opacity-20 animate-ping"></span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
