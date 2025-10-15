import { Download, Smartphone, Bell } from 'lucide-react';
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
  const { canInstall, installPWA, isInstalled, isIOS, isAndroid, isStandalone, enablePushNotifications, isPushSupported } = usePWA();

  const handleInstallFlow = async () => {
    try {
      if (isIOS) {
        // For iOS, we need to show installation instructions first
        const instructions = document.createElement('div');
        instructions.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <p>To install on iOS:</p>
            <ol style="text-align: left; margin-top: 10px;">
              <li>Tap the Share button <img src="/ios-share.svg" alt="Share" style="height: 20px; vertical-align: middle;"></li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" to confirm</li>
            </ol>
          </div>
        `;
        // You might want to use a proper modal/dialog component here
        alert('Please follow the instructions to install on iOS');
        return;
      }

      // Install PWA first (most important!)
      await installPWA();
      
      // AFTER installation, optionally ask for notifications
      // Only do this if the user successfully installed
      // if (isPushSupported) {
      //   setTimeout(() => {
      //     enablePushNotifications();
      //   }, 1000); // Small delay to let installation complete
      // }
    } catch (error) {
      console.error('Install flow error:', error);
    }
  };

  // On iOS Safari, always show the button when not installed (beforeinstallprompt is not fired)
  if (isInstalled) return null;
  if (!isIOS && !canInstall) return null;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleInstallFlow}
      className={`gap-2 ${className}`}
    >
      {isIOS ? <Smartphone className="w-4 h-4" /> : <Download className="w-4 h-4" />}
      {children || (isIOS ? 'Install on iOS' : 'Install App')}
    </Button>
  );
}

export function PWAInstallPrompt() {
  const { canInstall, installPWA, isInstalled, isIOS, isAndroid, isStandalone, enablePushNotifications, isPushSupported } = usePWA();

  const handlePromptFlow = async () => {
    try {
      if (isIOS) {
        // For iOS, show a proper dialog with installation instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <p>To install on iOS:</p>
            <ol style="text-align: left; margin-top: 10px;">
              <li>Tap the Share button <img src="/ios-share.svg" alt="Share" style="height: 20px; vertical-align: middle;"></li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" to confirm</li>
            </ol>
          </div>
        `;
        // You might want to use a proper modal/dialog component here
        alert('Please follow the instructions to install on iOS');
        return;
      }

      // Install PWA first (most important!)
      const installed = await installPWA();
      
      if (!installed) {
        console.warn('PWA installation was not successful');
      }
      
      // AFTER installation, optionally ask for notifications
      // Only do this if the user successfully installed
      // if (isPushSupported && installed) {
      //   setTimeout(() => {
      //     enablePushNotifications();
      //   }, 1000); // Small delay to let installation complete
      // }
    } catch (error) {
      console.error('Install flow error:', error);
    }
  };

  // Don't show if already installed or in standalone mode
  if (isInstalled || isStandalone) {
    return null;
  }

  // Show for iOS even without canInstall (manual instructions)
  // For Android/Desktop, only show if canInstall is true
  if (!isIOS && !canInstall) {
    return null;
  }

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
          onClick={handlePromptFlow}
          variant="secondary"
          size="sm"
          className="bg-white/90 text-blue-600 hover:bg-white hover:text-blue-700 font-semibold"
          disabled={!isIOS && !canInstall}
        >
          {isIOS ? 'How to Install' : 'Install'}
        </Button>
      </div>
    </div>
  );
}
