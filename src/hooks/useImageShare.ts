import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  renderFoodShareImage,
  canvasToBlob,
  downloadCanvasImage,
  FoodShareData,
  ShareImageOptions,
} from '@/lib/image-overlay';

export interface UseImageShareResult {
  isGenerating: boolean;
  isSharing: boolean;
  error: string | null;
  generatePreview: () => Promise<string | null>;
  downloadImage: () => Promise<void>;
  shareToNative: () => Promise<void>;
  shareToClipboard: () => Promise<void>;
}

export function useImageShare(foodData: FoodShareData, isDarkMode: boolean = false): UseImageShareResult {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedCanvas, setCachedCanvas] = useState<HTMLCanvasElement | null>(null);

  const enrichedData: FoodShareData = {
    ...foodData,
    isDarkMode: isDarkMode || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false),
  };

  /**
   * Generate preview - returns blob URL for display
   */
  const generatePreview = useCallback(async (): Promise<string | null> => {
    try {
      setIsGenerating(true);
      setError(null);

      const options: ShareImageOptions = {
        format: 'custom',
        dpi: 2,
      };

      const canvas = await renderFoodShareImage(enrichedData, options);
      setCachedCanvas(canvas);

      return canvas.toDataURL('image/png');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate preview';
      setError(message);
      toast({
        title: 'Preview Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [enrichedData, toast]);

  /**
   * Download image in specific format
   */
  const downloadImage = useCallback(
    async (format: 'instagram-story' | 'instagram-post' | 'square' = 'instagram-post') => {
      try {
        setIsSharing(true);
        setError(null);

        const options: ShareImageOptions = {
          format,
          dpi: 2,
        };

        const canvas = await renderFoodShareImage(enrichedData, options);
        const filename = `fuel-score-${enrichedData.foodName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
        await downloadCanvasImage(canvas, filename);

        toast({
          title: 'Image Downloaded',
          description: `Image saved as ${filename}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to download image';
        setError(message);
        toast({
          title: 'Download Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsSharing(false);
      }
    },
    [enrichedData, toast]
  );

  /**
   * Share using native Web Share API
   */
  const shareToNative = useCallback(async () => {
    try {
      // Check if Web Share API is available
      if (!navigator.share) {
        throw new Error('Web Share API not available on this device');
      }

      setIsSharing(true);
      setError(null);

      if (!cachedCanvas) {
        await generatePreview();
      }

      if (!cachedCanvas) {
        throw new Error('Failed to generate image for sharing');
      }

      // Convert canvas to blob
      const blob = await canvasToBlob(cachedCanvas);
      const file = new File([blob], 'food-share.png', { type: 'image/png' });

      // Share via native API
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Check out my meal - ${enrichedData.foodName}`,
          text: `${enrichedData.calories} kcal | P: ${enrichedData.protein}g C: ${enrichedData.carbs}g F: ${enrichedData.fat}g`,
          files: [file],
        });

        toast({
          title: 'Shared!',
          description: 'Image shared successfully',
        });
      } else {
        throw new Error('File sharing not supported');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to share image';
      setError(message);
      toast({
        title: 'Share Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSharing(false);
    }
  }, [cachedCanvas, enrichedData, generatePreview, toast]);

  /**
   * Copy image to clipboard
   */
  const shareToClipboard = useCallback(async () => {
    try {
      // Check if Clipboard API is available
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not available');
      }

      setIsSharing(true);
      setError(null);

      if (!cachedCanvas) {
        await generatePreview();
      }

      if (!cachedCanvas) {
        throw new Error('Failed to generate image');
      }

      // Get canvas as blob
      const blob = await canvasToBlob(cachedCanvas);

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);

      toast({
        title: 'Copied to Clipboard',
        description: 'Image ready to paste',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to copy to clipboard';
      setError(message);
      toast({
        title: 'Clipboard Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSharing(false);
    }
  }, [cachedCanvas, generatePreview, toast]);

  return {
    isGenerating,
    isSharing,
    error,
    generatePreview,
    downloadImage,
    shareToNative,
    shareToClipboard,
  };
}
