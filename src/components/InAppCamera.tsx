import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, RotateCw, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface InAppCameraProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function InAppCamera({ open, onClose, onCapture }: InAppCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Initialize camera when dialog opens
  useEffect(() => {
    if (open) {
      startCamera();
      checkMultipleCameras();
    } else {
      stopCamera();
      setCapturedImage(null);
      setError(null);
    }
    
    return () => {
      stopCamera();
    };
  }, [open, facingMode]);

  const checkMultipleCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    } catch (err) {
      console.error('Error checking cameras:', err);
    }
  };

  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Stop any existing stream
      stopCamera();

      // Request camera access
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });
        await videoRef.current.play();
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Camera error:', err);
      setIsLoading(false);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is already in use by another app.');
      } else {
        setError('Unable to access camera. Please try again.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image as data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    
    // Stop camera preview
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (!capturedImage || !canvasRef.current) return;

    // Convert canvas to blob and create File object
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      
      const file = new File(
        [blob],
        `food_photo_${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      );
      
      onCapture(file);
      onClose();
    }, 'image/jpeg', 0.9);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-full h-full md:max-w-2xl md:h-auto p-0 gap-0">
        <div className="relative w-full h-full flex flex-col bg-black">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
            <h3 className="text-white font-semibold">Take Photo</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Camera Preview or Captured Image */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {error ? (
              <div className="text-center p-6 max-w-sm">
                <Camera className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <p className="text-white mb-4">{error}</p>
                <Button onClick={startCamera} variant="secondary">
                  Try Again
                </Button>
              </div>
            ) : capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="max-w-full max-h-full object-contain"
                  playsInline
                  muted
                />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center">
                      <Camera className="h-12 w-12 mx-auto mb-2 text-white animate-pulse" />
                      <p className="text-white">Starting camera...</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 z-10 p-6 bg-gradient-to-t from-black/80 to-transparent">
            {capturedImage ? (
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={retakePhoto}
                  variant="secondary"
                  size="lg"
                  className="flex-1 max-w-[150px]"
                >
                  <RotateCw className="h-5 w-5 mr-2" />
                  Retake
                </Button>
                <Button
                  onClick={confirmPhoto}
                  size="lg"
                  className="flex-1 max-w-[150px] bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Use Photo
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                {hasMultipleCameras && !isLoading && (
                  <Button
                    onClick={switchCamera}
                    variant="secondary"
                    size="icon"
                    className="rounded-full h-12 w-12"
                  >
                    <RotateCw className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  onClick={capturePhoto}
                  disabled={isLoading || !!error}
                  size="icon"
                  className="rounded-full h-16 w-16 bg-white hover:bg-gray-200"
                >
                  <Camera className="h-8 w-8 text-black" />
                </Button>
                {hasMultipleCameras && <div className="h-12 w-12" />}
              </div>
            )}
          </div>

          {/* Hidden canvas for image capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

