import { Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';

interface PWAInstallButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children?: React.ReactNode;
}

export function PWAInstallButton({ 
  variant = 'outline', 
  size = 'default',
  className = '',
  children 
}: PWAInstallButtonProps) {
  const { canInstall, installPWA, isInstalled } = usePWA();

  if (isInstalled || !canInstall) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={installPWA}
      className={`gap-2 ${className}`}
    >
      <Download className="w-4 h-4" />
      {children || 'Install App'}
    </Button>
  );
}

export function PWAInstallPrompt() {
  const { canInstall, installPWA, isInstalled } = usePWA();

  // For debugging - always show the prompt for now
  // if (isInstalled || !canInstall) {
  //   return null;
  // }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
      <div className="flex items-center gap-3">
        <Smartphone className="w-6 h-6" />
        <div className="flex-1">
          <h3 className="font-semibold">Install Nutrisync</h3>
          <p className="text-sm text-blue-100">
            Get quick access and a better experience with our app
          </p>
        </div>
        <Button
          onClick={installPWA}
          variant="secondary"
          size="sm"
          className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
          disabled={!canInstall}
        >
          Install
        </Button>
      </div>
    </div>
  );
}
