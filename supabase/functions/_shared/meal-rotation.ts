/**
 * Meal Rotation System
 * 
 * Provides 7 different Indonesian meal templates for each training load
 * to ensure variety throughout the week without AI costs.
 * 
 * Each template rotates based on day of week (0-6)
 * Weekly AI refresh generates new ideas on Sundays
 */

import { TrainingLoad } from './nutrition-unified.ts';

export interface MealTemplate {
  name: string;
  description: string;
  foods: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayMealPlan {
  breakfast: MealTemplate[];
  lunch: MealTemplate[];
  dinner: MealTemplate[];
  snack?: MealTemplate[];
}

/**
 * 7-day rotation templates for REST days
 */
const REST_TEMPLATES: DayMealPlan[] = [
  // Day 0 (Sunday)
  {
    breakfast: [
      {
        name: "Nasi Uduk + Ayam Goreng",
        description: "Nasi uduk dengan ayam goreng dan sambal kacang",
        foods: ["Nasi uduk (150g)", "Ayam goreng (100g)", "Sambal kacang (30g)", "Timun (50g)"],
        calories: 450,
        protein: 25,
        carbs: 45,
        fat: 18
      },
      {
        name: "Roti Bakar + Telur Orak-Arik",
        description: "Roti gandum dengan telur orak-arik dan alpukat",
        foods: ["Roti gandum (80g)", "Telur (2 butir)", "Alpukat (50g)", "Madu (10g)"],
        calories: 420,
        protein: 22,
        carbs: 42,
        fat: 16
      }
    ],
    lunch: [
      {
        name: "Gado-gado",
        description: "Salad sayuran dengan bumbu kacang",
        foods: ["Sayuran segar (200g)", "Tahu (80g)", "Tempe (60g)", "Bumbu kacang (45g)", "Lontong (100g)"],
        calories: 480,
        protein: 28,
        carbs: 42,
        fat: 22
      },
      {
        name: "Pecel",
        description: "Sayuran rebus dengan sambal pecel",
        foods: ["Sayuran rebus (200g)", "Tempe (80g)", "Tahu (60g)", "Sambal pecel (40g)", "Nasi putih (100g)"],
        calories: 460,
        protein: 26,
        carbs: 45,
        fat: 20
      }
    ],
    dinner: [
      {
        name: "Ikan Bakar + Sambal Dabu-Dabu",
        description: "Ikan kakap bakar dengan sambal segar",
        foods: ["Ikan kakap (150g)", "Nasi putih (120g)", "Sambal dabu-dabu (50g)", "Lalapan (80g)"],
        calories: 450,
        protein: 35,
        carbs: 40,
        fat: 15
      }
    ]
  },
  
  // Day 1 (Monday)
  {
    breakfast: [
      {
        name: "Bubur Ayam",
        description: "Bubur nasi dengan ayam suwir dan pelengkap",
        foods: ["Bubur nasi (200g)", "Ayam suwir (80g)", "Kacang kedelai (20g)", "Bawang goreng (5g)", "Kerupuk (10g)"],
        calories: 380,
        protein: 22,
        carbs: 48,
        fat: 10
      },
      {
        name: "Lontong Sayur",
        description: "Lontong dengan sayur santan",
        foods: ["Lontong (120g)", "Sayur lodeh (150g)", "Tempe goreng (60g)", "Kerupuk (10g)"],
        calories: 400,
        protein: 18,
        carbs: 52,
        fat: 14
      }
    ],
    lunch: [
      {
        name: "Ayam Penyet",
        description: "Ayam goreng geprek dengan sambal terasi",
        foods: ["Ayam goreng (120g)", "Nasi putih (150g)", "Tempe (50g)", "Sambal terasi (30g)", "Lalapan (80g)"],
        calories: 550,
        protein: 35,
        carbs: 52,
        fat: 22
      }
    ],
    dinner: [
      {
        name: "Sop Buntut",
        description: "Sup buntut sapi dengan sayuran",
        foods: ["Buntut sapi (100g)", "Nasi putih (120g)", "Wortel (50g)", "Kentang (60g)", "Bawang goreng (5g)"],
        calories: 480,
        protein: 30,
        carbs: 45,
        fat: 18
      }
    ]
  },
  
  // Day 2 (Tuesday)
  {
    breakfast: [
      {
        name: "Nasi Goreng",
        description: "Nasi goreng dengan telur mata sapi",
        foods: ["Nasi goreng (200g)", "Telur mata sapi (1 butir)", "Ayam suwir (50g)", "Kerupuk (10g)", "Acar (30g)"],
        calories: 480,
        protein: 24,
        carbs: 58,
        fat: 16
      }
    ],
    lunch: [
      {
        name: "Soto Ayam",
        description: "Soto ayam kuning dengan nasi",
        foods: ["Ayam (100g)", "Nasi putih (150g)", "Kuah soto (200ml)", "Soun (30g)", "Telur rebus (1 butir)", "Perkedel (40g)"],
        calories: 520,
        protein: 32,
        carbs: 55,
        fat: 18
      }
    ],
    dinner: [
      {
        name: "Pecel Lele",
        description: "Lele goreng dengan sambal dan lalapan",
        foods: ["Lele goreng (150g)", "Nasi putih (120g)", "Lalapan (100g)", "Sambal terasi (30g)", "Tempe (40g)"],
        calories: 480,
        protein: 32,
        carbs: 42,
        fat: 20
      }
    ]
  },
  
  // Day 3 (Wednesday)
  {
    breakfast: [
      {
        name: "Mie Goreng",
        description: "Mie goreng dengan sayuran dan telur",
        foods: ["Mie telur (150g)", "Sayuran (100g)", "Telur (1 butir)", "Ayam (60g)", "Kecap (15ml)"],
        calories: 460,
        protein: 26,
        carbs: 52,
        fat: 16
      }
    ],
    lunch: [
      {
        name: "Nasi Padang",
        description: "Nasi putih dengan rendang dan sayuran",
        foods: ["Nasi putih (150g)", "Rendang daging (100g)", "Sayur daun singkong (100g)", "Sambal ijo (20g)", "Kerupuk (10g)"],
        calories: 580,
        protein: 32,
        carbs: 48,
        fat: 28
      }
    ],
    dinner: [
      {
        name: "Ayam Bakar",
        description: "Ayam bakar dengan bumbu kecap",
        foods: ["Ayam bakar (150g)", "Nasi putih (120g)", "Lalapan (80g)", "Sambal (25g)"],
        calories: 490,
        protein: 38,
        carbs: 42,
        fat: 18
      }
    ]
  },
  
  // Day 4 (Thursday)
  {
    breakfast: [
      {
        name: "Nasi Kuning",
        description: "Nasi kuning dengan ayam dan telur",
        foods: ["Nasi kuning (150g)", "Ayam goreng (80g)", "Telur balado (1 butir)", "Tempe orek (40g)", "Serundeng (20g)"],
        calories: 500,
        protein: 28,
        carbs: 50,
        fat: 20
      }
    ],
    lunch: [
      {
        name: "Rawon",
        description: "Sup daging dengan bumbu hitam khas Jawa Timur",
        foods: ["Daging sapi (120g)", "Nasi putih (150g)", "Tauge (60g)", "Telur asin (½ butir)", "Sambal (15g)"],
        calories: 520,
        protein: 35,
        carbs: 48,
        fat: 20
      }
    ],
    dinner: [
      {
        name: "Ikan Goreng + Sambal Matah",
        description: "Ikan goreng dengan sambal khas Bali",
        foods: ["Ikan kembung (150g)", "Nasi putih (120g)", "Sambal matah (40g)", "Lalapan (80g)"],
        calories: 470,
        protein: 34,
        carbs: 42,
        fat: 18
      }
    ]
  },
  
  // Day 5 (Friday)
  {
    breakfast: [
      {
        name: "Ketoprak",
        description: "Lontong dengan tahu dan bumbu kacang",
        foods: ["Lontong (120g)", "Tahu (80g)", "Tauge (60g)", "Bumbu kacang (45g)", "Kerupuk (15g)"],
        calories: 420,
        protein: 20,
        carbs: 48,
        fat: 18
      }
    ],
    lunch: [
      {
        name: "Sate Ayam",
        description: "Sate ayam dengan lontong dan bumbu kacang",
        foods: ["Sate ayam (150g)", "Lontong (100g)", "Bumbu kacang (40g)", "Timun (50g)", "Bawang merah (20g)"],
        calories: 540,
        protein: 38,
        carbs: 45,
        fat: 24
      }
    ],
    dinner: [
      {
        name: "Tongseng Kambing",
        description: "Tongseng kambing dengan kuah manis pedas",
        foods: ["Daging kambing (100g)", "Nasi putih (120g)", "Kubis (60g)", "Tomat (40g)", "Cabai (20g)"],
        calories: 500,
        protein: 30,
        carbs: 42,
        fat: 22
      }
    ]
  },
  
  // Day 6 (Saturday)
  {
    breakfast: [
      {
        name: "Nasi Pecel",
        description: "Nasi dengan sayuran dan sambal pecel",
        foods: ["Nasi putih (150g)", "Sayuran rebus (150g)", "Tempe (60g)", "Rempeyek (20g)", "Sambal pecel (40g)"],
        calories: 450,
        protein: 22,
        carbs: 52,
        fat: 18
      }
    ],
    lunch: [
      {
        name: "Gudeg",
        description: "Gudeg Jogja dengan ayam dan telur",
        foods: ["Gudeg (150g)", "Nasi putih (120g)", "Ayam (80g)", "Telur pindang (1 butir)", "Krecek (30g)"],
        calories: 530,
        protein: 30,
        carbs: 55,
        fat: 20
      }
    ],
    dinner: [
      {
        name: "Bebek Goreng",
        description: "Bebek goreng dengan sambal",
        foods: ["Bebek goreng (150g)", "Nasi putih (120g)", "Lalapan (80g)", "Sambal (25g)"],
        calories: 520,
        protein: 36,
        carbs: 42,
        fat: 22
      }
    ]
  }
];

/**
 * Get meal template for a specific day and training load
 */
export function getRotationTemplate(
  trainingLoad: TrainingLoad,
  dayOfWeek: number, // 0-6 (Sunday-Saturday)
  targetCalories: number
): DayMealPlan {
  // For now, use REST templates as base
  // TODO: Create specific templates for easy, moderate, long, quality
  const templates = REST_TEMPLATES;
  const template = templates[dayOfWeek % templates.length];
  
  // Scale meals to match target calories
  const currentTotal = template.breakfast[0].calories + 
                      template.lunch[0].calories + 
                      template.dinner[0].calories;
  const scaleFactor = targetCalories / currentTotal;
  
  // If need snack (high calorie days)
  const needsSnack = trainingLoad === 'long' || trainingLoad === 'quality';
  
  if (needsSnack && !template.snack) {
    template.snack = [
      {
        name: "Pisang + Susu Kedelai",
        description: "Snack pemulihan pasca lari",
        foods: ["Pisang (120g)", "Susu kedelai (200ml)", "Madu (15g)"],
        calories: Math.round(targetCalories * 0.15),
        protein: Math.round(targetCalories * 0.15 * 0.15 / 4),
        carbs: Math.round(targetCalories * 0.15 * 0.65 / 4),
        fat: Math.round(targetCalories * 0.15 * 0.20 / 9)
      }
    ];
  }
  
  return template;
}

/**
 * Check if today should trigger AI refresh (Sunday)
 */
export function shouldUseAIToday(): boolean {
  const today = new Date();
  return today.getDay() === 0; // 0 = Sunday
}

/**
 * Get current day of week (0-6)
 */
export function getCurrentDayOfWeek(): number {
  return new Date().getDay();
}

/**
 * Get week number of the year (for rotation tracking)
 */
export function getWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}
