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
      color: 'from-red-500 to-red-600'
    },
    {
      icon: Utensils,
      label: 'Log Meal',
      onClick: () => {
        setIsOpen(false);
        if (onLogMeal) onLogMeal();
      },
      color: 'from-green-500 to-green-600'
    },
    {
      icon: Bell,
      label: 'Set Reminder',
      onClick: () => {
        setIsOpen(false);
        navigate('/profile');
      },
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: TrendingUp,
      label: 'View Progress',
      onClick: () => {
        setIsOpen(false);
        navigate('/goals');
      },
      color: 'from-purple-500 to-purple-600'
    }
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 animate-in fade-in duration-200"
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
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg">
                    <span className="text-sm font-medium whitespace-nowrap">
                      {action.label}
                    </span>
                  </div>
                  <button
                    onClick={action.onClick}
                    className={`w-14 h-14 bg-gradient-to-br ${action.color} text-white rounded-full shadow-xl active:scale-95 transition-transform flex items-center justify-center`}
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
          className={`w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 text-white rounded-full shadow-2xl active:scale-95 transition-all duration-300 flex items-center justify-center relative touch-manipulation ${
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
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 animate-ping opacity-20"></span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
