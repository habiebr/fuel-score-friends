import { useState } from 'react';
import { Plus, X, Utensils, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActionFABProps {
  onLogMeal?: () => void;
  onUploadActivity?: () => void;
}

export function ActionFAB({ onLogMeal, onUploadActivity }: ActionFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggleFAB = () => {
    setIsOpen(!isOpen);
  };

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 safe-area-inset-bottom">
      {/* Action Buttons - Simple Stack */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 flex flex-col-reverse gap-3">
          
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white bg-black/80 px-3 py-2 rounded-lg whitespace-nowrap">
              Log Meal
            </span>
            <button
              onClick={() => handleAction(() => onLogMeal?.())}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-500 text-white shadow-lg transition-all duration-200 active:scale-95"
            >
              <Utensils className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white bg-black/80 px-3 py-2 rounded-lg whitespace-nowrap">
              Upload Activity
            </span>
            <button
              onClick={() => handleAction(() => onUploadActivity?.())}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-info to-sky-500 text-white shadow-lg transition-all duration-200 active:scale-95"
            >
              <Activity className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={toggleFAB}
        className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-500 text-white shadow-[0_8px_32px_rgba(49,255,176,0.4)] transition-all duration-200 touch-manipulation active:scale-95 ${
          isOpen ? 'rotate-45' : ''
        }`}
        aria-label={isOpen ? 'Close menu' : 'Open actions menu'}
      >
        {isOpen ? (
          <X className="w-8 h-8" />
        ) : (
          <Plus className="w-8 h-8" />
        )}
      </button>
    </div>
  );
}
