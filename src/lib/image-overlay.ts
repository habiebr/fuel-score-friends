export interface FoodShareData {
  foodName: string;
  imageUrl: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: Date;
  userName?: string;
  mealType?: string;
  trainingInfo?: string;
  isDarkMode?: boolean;
}

export interface ShareImageOptions {
  width?: number;
  height?: number;
  dpi?: number;
  format?: 'instagram-story' | 'instagram-post' | 'square' | 'custom';
}

// Dimensions for different formats
const FORMATS = {
  'instagram-story': { width: 1080, height: 1920 },
  'instagram-post': { width: 1200, height: 1200 },
  'square': { width: 1080, height: 1080 },
  'custom': { width: 1080, height: 1350 }, // Default
};

const COLORS = {
  light: {
    background: '#FFFFFF',
    foreground: '#1F2937',
    accent: '#3B82F6',
    card: '#F3F4F6',
    border: '#E5E7EB',
    proteinColor: '#EF4444', // Red
    carbsColor: '#FBBF24', // Amber
    fatColor: '#10B981', // Green
    text: '#111827',
    textSecondary: '#6B7280',
  },
  dark: {
    background: '#111827',
    foreground: '#F9FAFB',
    accent: '#60A5FA',
    card: '#1F2937',
    border: '#374151',
    proteinColor: '#FCA5A5', // Light Red
    carbsColor: '#FCD34D', // Light Amber
    fatColor: '#6EE7B7', // Light Green
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
  },
};

/**
 * Load image as canvas-ready data
 */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
    img.src = url;
  });
}

/**
 * Draw circular progress ring
 */
function drawProgressRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  current: number,
  target: number,
  color: string,
  lineWidth: number = 12
) {
  const percentage = Math.min(current / target, 1);
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (percentage * 2 * Math.PI);

  // Background circle
  ctx.strokeStyle = color + '30'; // 18% opacity
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  // Progress circle
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, radius, startAngle, endAngle);
  ctx.stroke();
}

/**
 * Draw macro card with circular progress
 */
function drawMacroCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  current: number,
  target: number,
  color: string,
  colors: typeof COLORS.light,
  fontSize: number = 24
) {
  // Card background
  ctx.fillStyle = colors.card;
  ctx.fillRect(x, y, width, height);
  
  // Card border
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // Progress ring
  const ringRadius = (width * 0.25);
  drawProgressRing(ctx, x + width * 0.25, y + height * 0.5, ringRadius, current, target, color, 8);

  // Value text
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(current)}g`, x + width * 0.25, y + height * 0.5 + fontSize * 0.3);

  // Label text
  ctx.fillStyle = colors.textSecondary;
  ctx.font = `600 ${fontSize * 0.6}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + width * 0.75, y + height * 0.35);

  // Target text
  ctx.fillStyle = colors.textSecondary;
  ctx.font = `400 ${fontSize * 0.5}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
  ctx.textAlign = 'center';
  ctx.fillText(`${target}g target`, x + width * 0.75, y + height * 0.65);
}

/**
 * Main function to render food share image
 */
export async function renderFoodShareImage(
  data: FoodShareData,
  options: ShareImageOptions = {}
): Promise<Canvas> {
  const format = options.format || 'custom';
  const dpi = options.dpi || 2;
  const dims = FORMATS[format];
  const width = options.width || dims.width;
  const height = options.height || dims.height;

  // Scale for DPI
  const scaledWidth = width * dpi;
  const scaledHeight = height * dpi;

  const canvas = document.createElement('canvas');
  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  const colors = data.isDarkMode ? COLORS.dark : COLORS.light;
  const scale = dpi;

  // Background
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, scaledWidth, scaledHeight);

  // Load and draw food image
  try {
    const img = await loadImage(data.imageUrl);
    const imageHeight = scaledWidth * 0.6;

    // Draw image with slight rounded top corners effect
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(scaledWidth, 0);
    ctx.lineTo(scaledWidth, imageHeight);
    ctx.lineTo(0, imageHeight);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(img, 0, 0, scaledWidth, imageHeight);
    ctx.restore();

    // Add subtle gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, 0, imageHeight);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, colors.background + 'CC');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, scaledWidth, imageHeight);

    // Title section (Food name + calories)
    const titleY = imageHeight + 40 * scale;
    ctx.fillStyle = colors.text;
    ctx.font = `bold ${48 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    ctx.textAlign = 'left';
    ctx.fillText(data.foodName, 40 * scale, titleY);

    // Calories prominent display
    ctx.fillStyle = '#FF6B35'; // Vibrant orange like Strava
    ctx.font = `bold ${64 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    ctx.fillText(`${Math.round(data.calories)}`, 40 * scale, titleY + 80 * scale);

    ctx.fillStyle = colors.textSecondary;
    ctx.font = `400 ${32 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    ctx.fillText('kcal', 280 * scale, titleY + 70 * scale);

    // Macro section header
    const macroSectionY = titleY + 140 * scale;
    ctx.fillStyle = colors.text;
    ctx.font = `600 ${28 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    ctx.fillText('Macros', 40 * scale, macroSectionY);

    // Three macro cards in a row
    const cardWidth = (scaledWidth - 80 * scale) / 3;
    const cardHeight = 160 * scale;
    const cardSpacing = 20 * scale;

    drawMacroCard(
      ctx,
      40 * scale,
      macroSectionY + 50 * scale,
      cardWidth,
      cardHeight,
      'Protein',
      data.protein,
      Math.round(data.protein * 1.2), // Assume 20% buffer for target
      colors.proteinColor,
      colors,
      20 * scale
    );

    drawMacroCard(
      ctx,
      40 * scale + cardWidth + cardSpacing,
      macroSectionY + 50 * scale,
      cardWidth,
      cardHeight,
      'Carbs',
      data.carbs,
      Math.round(data.carbs * 1.2),
      colors.carbsColor,
      colors,
      20 * scale
    );

    drawMacroCard(
      ctx,
      40 * scale + (cardWidth + cardSpacing) * 2,
      macroSectionY + 50 * scale,
      cardWidth,
      cardHeight,
      'Fat',
      data.fat,
      Math.round(data.fat * 1.2),
      colors.fatColor,
      colors,
      20 * scale
    );

    // Footer section
    const footerY = macroSectionY + 50 * scale + cardHeight + 60 * scale;
    
    if (data.userName) {
      ctx.fillStyle = colors.text;
      ctx.font = `600 ${24 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
      ctx.fillText(data.userName, 40 * scale, footerY);
    }

    if (data.mealType) {
      ctx.fillStyle = colors.accent;
      ctx.fillRect(40 * scale, footerY + 20 * scale, 200 * scale, 40 * scale);
      
      ctx.fillStyle = colors.background;
      ctx.font = `600 ${20 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
      ctx.textAlign = 'center';
      ctx.fillText(data.mealType.charAt(0).toUpperCase() + data.mealType.slice(1), 140 * scale, footerY + 48 * scale);
    }

    // Date
    const dateStr = data.date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    ctx.fillStyle = colors.textSecondary;
    ctx.font = `400 ${20 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    ctx.textAlign = 'left';
    ctx.fillText(dateStr, 40 * scale, scaledHeight - 40 * scale);

    // Branding
    ctx.fillStyle = colors.accent;
    ctx.font = `600 ${20 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    ctx.textAlign = 'right';
    ctx.fillText('🏃 Fuel Score', scaledWidth - 40 * scale, scaledHeight - 40 * scale);
  } catch (error) {
    console.error('Error rendering food share image:', error);
    // Fallback: render without image
    ctx.fillStyle = colors.card;
    ctx.fillRect(0, 0, scaledWidth, scaledHeight);
  }

  return canvas;
}

/**
 * Convert canvas to blob for download/sharing
 */
export async function canvasToBlob(
  canvas: Canvas,
  quality: number = 0.95,
  type: string = 'image/png'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert canvas to blob'));
      },
      type,
      quality
    );
  });
}

/**
 * Download canvas as image
 */
export async function downloadCanvasImage(
  canvas: Canvas,
  filename: string = 'food-share.png'
) {
  try {
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
}
