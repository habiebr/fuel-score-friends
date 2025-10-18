import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  Copy,
  Share2,
  Smartphone,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useImageShare } from '@/hooks/useImageShare';
import { FoodShareData } from '@/lib/image-overlay';

interface FoodShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foodData: FoodShareData;
}

export function FoodShareDialog({ open, onOpenChange, foodData }: FoodShareDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'instagram-story' | 'instagram-post' | 'square'>(
    'instagram-post'
  );
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  );

  const { isGenerating, isSharing, error, generatePreview, downloadImage, shareToNative, shareToClipboard } =
    useImageShare(foodData, isDarkMode);

  // Generate preview on dialog open or data change
  useEffect(() => {
    if (open && !previewUrl) {
      generatePreview().then(setPreviewUrl);
    }
  }, [open, previewUrl, generatePreview]);

  // Detect dark mode changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleFormatChange = async (newFormat: 'instagram-story' | 'instagram-post' | 'square') => {
    setSelectedFormat(newFormat);
    setPreviewUrl(null);
    // Preview will regenerate due to useEffect
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Your Meal
          </DialogTitle>
          <DialogDescription>
            Create a beautiful image of <strong>{foodData.foodName}</strong> with macro overlay
          </DialogDescription>
        </DialogHeader>

        {/* Preview Section */}
        <div className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-96">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating preview...</p>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Food share preview"
                className="max-w-full max-h-96 rounded-lg shadow-lg object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="w-12 h-12 opacity-50" />
                <p className="text-sm">Failed to load preview</p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/50 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Format Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold">Image Format</label>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { id: 'instagram-story' as const, label: 'Story', sub: '1080×1920' },
                { id: 'instagram-post' as const, label: 'Post', sub: '1200×1200' },
                { id: 'square' as const, label: 'Square', sub: '1080×1080' },
              ] as const
            ).map((format) => (
              <button
                key={format.id}
                onClick={() => handleFormatChange(format.id)}
                disabled={isGenerating || isSharing}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  selectedFormat === format.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="font-medium text-sm">{format.label}</div>
                <div className="text-xs text-muted-foreground">{format.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
          <span className="text-sm font-medium flex-grow">Preview Theme</span>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="px-3 py-1 rounded-full border border-border hover:bg-muted text-sm font-medium transition-colors"
          >
            {isDarkMode ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        {/* Share Options - Tabs */}
        <Tabs defaultValue="download" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="download" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </TabsTrigger>
            <TabsTrigger value="clipboard" className="flex items-center gap-2">
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Copy</span>
            </TabsTrigger>
            <TabsTrigger value="share" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </TabsTrigger>
          </TabsList>

          {/* Download Tab */}
          <TabsContent value="download" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Download high-resolution image in your chosen format. Perfect for posting to social media.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {(['instagram-post', 'instagram-story', 'square'] as const).map((format) => {
                const labels = {
                  'instagram-post': 'Download for Instagram Post',
                  'instagram-story': 'Download for Instagram Story',
                  square: 'Download as Square',
                };
                return (
                  <Button
                    key={format}
                    onClick={() => downloadImage(format)}
                    disabled={isGenerating || isSharing}
                    className="w-full"
                    variant="outline"
                  >
                    {isSharing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        {labels[format]}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
              💡 Tip: Downloaded images are ready to upload to your favorite social platform
            </p>
          </TabsContent>

          {/* Clipboard Tab */}
          <TabsContent value="clipboard" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy the image directly to your clipboard. Paste it anywhere you can paste images.
            </p>
            <Button
              onClick={shareToClipboard}
              disabled={isGenerating || isSharing}
              className="w-full"
              size="lg"
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
              ✓ Image copied! Paste it in WhatsApp, Telegram, email, or any messaging app
            </p>
          </TabsContent>

          {/* Share Tab */}
          <TabsContent value="share" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use your device's native sharing options to send directly to apps or contacts.
            </p>
            <Button
              onClick={shareToNative}
              disabled={isGenerating || isSharing || !navigator.share}
              className="w-full"
              size="lg"
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : !navigator.share ? (
                <>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Not Available on Your Device
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 mr-2" />
                  Share to Apps
                </>
              )}
            </Button>
            {!navigator.share && (
              <p className="text-xs text-muted-foreground bg-yellow-100/20 border border-yellow-200/30 dark:bg-yellow-900/10 dark:border-yellow-800/30 p-2 rounded">
                ℹ️ Native sharing is not available on your device. Use Download or Copy options instead.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-lg">📊</span>
            <div>
              <p className="font-medium text-sm text-blue-900 dark:text-blue-100">What's included:</p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1 list-disc list-inside">
                <li>Food photo with beautiful overlay</li>
                <li>Calorie count prominently displayed</li>
                <li>Macro breakdown with progress rings</li>
                <li>Date and meal type badge</li>
                <li>Fuel Score branding</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
