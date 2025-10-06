export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
}

export type TrainingLoad = 'rest' | 'easy' | 'moderate' | 'long' | 'quality';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface DayTarget {
  date: string;
  load: TrainingLoad;
  kcal: number;
  grams: {
    cho: number;
    protein: number;
    fat: number;
  };
  fueling: {
    pre?: { hoursBefore: number; cho_g: number };
    duringCHOgPerHour?: number | null;
    post?: { minutesAfter: number; cho_g: number; protein_g: number };
  };
  meals: Array<{
    meal: MealType;
    ratio: number;
    cho_g: number;
    protein_g: number;
    fat_g: number;
    kcal: number;
  }>;
}

/**
 * Step 1: Calculate BMR using Mifflin-St Jeor equation
 */
export function calculateBMR(profile: UserProfile): number {
  const { weightKg, heightCm, age, sex } = profile;
  const sexOffset = sex === 'male' ? 5 : -161;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset);
}

/**
 * Step 2: Get activity factor based on training load
 */
export function getActivityFactor(load: TrainingLoad): number {
  const factors: Record<TrainingLoad, number> = {
    rest: 1.4,
    easy: 1.6,
    moderate: 1.8,
    long: 2.0,
    quality: 2.1
  };
  return factors[load];
}

/**
 * Step 3: Get macro targets per kg body weight
 * Exact values from science table
 */
export function getMacroTargetsPerKg(load: TrainingLoad): { cho: number; protein: number } {
  const targets: Record<TrainingLoad, { cho: [number, number]; protein: [number, number] }> = {
    rest: { cho: [3, 4], protein: [1.6, 1.6] },
    easy: { cho: [5, 6], protein: [1.6, 1.8] },
    moderate: { cho: [6, 8], protein: [1.8, 1.8] },
    long: { cho: [8, 10], protein: [1.8, 2.0] },
    quality: { cho: [7, 9], protein: [1.8, 2.0] }
  };

  // Use midpoints for MVP as specified
  const range = targets[load];
  return {
    cho: (range.cho[0] + range.cho[1]) / 2,
    protein: (range.protein[0] + range.protein[1]) / 2
  };
}

/**
 * Step 4: Get meal ratios based on training load
 */
export function getMealRatios(load: TrainingLoad): Record<MealType, number> {
  if (load === 'rest') {
    return {
      breakfast: 0.30,
      lunch: 0.35,
      dinner: 0.35,
      snack: 0
    };
  }
  return {
    breakfast: 0.25,
    lunch: 0.30,
    dinner: 0.30,
    snack: 0.15
  };
}

/**
 * Step 5: Calculate fueling windows based on load
 * Exact values from science table
 */
export function calculateFuelingWindows(profile: UserProfile, load: TrainingLoad): DayTarget['fueling'] {
  const { weightKg } = profile;
  
  // Pre-workout windows from science table
  const preWorkoutRanges: Record<TrainingLoad, { cho: [number, number]; hours: [number, number] } | null> = {
    rest: null,
    easy: { cho: [0.5, 1], hours: [2, 3] },
    moderate: { cho: [1, 2], hours: [3, 4] },
    long: { cho: [1, 4], hours: [3, 4] },
    quality: { cho: [1, 3], hours: [3, 4] }
  };

  // During-workout CHO from science table
  const duringRanges: Record<TrainingLoad, [number, number] | null> = {
    rest: null,
    easy: null, // optional in table
    moderate: [30, 45],
    long: [45, 75], // up to 90 for very long sessions
    quality: [45, 60]
  };

  // Post-workout recovery from science table
  const postRanges: Record<TrainingLoad, { cho: number; protein: number } | null> = {
    rest: null,
    easy: { cho: 0.8, protein: 0.25 },
    moderate: { cho: 1.0, protein: 0.3 },
    long: { cho: 1.1, protein: 0.3 }, // midpoint of 1.0-1.2
    quality: { cho: 1.0, protein: 0.3 }
  };

  const result: DayTarget['fueling'] = {};

  // Add pre-workout window if applicable
  const preRange = preWorkoutRanges[load];
  if (preRange) {
    result.pre = {
      hoursBefore: preRange.hours[0], // Use minimum for MVP
      cho_g: Math.round(weightKg * ((preRange.cho[0] + preRange.cho[1]) / 2)) // Use midpoint
    };
  }

  // Add during-workout CHO if applicable and duration ≥75 min
  const duringRange = duringRanges[load];
  if (duringRange) {
    result.duringCHOgPerHour = Math.round((duringRange[0] + duringRange[1]) / 2); // Use midpoint
  }

  // Add post-workout window if applicable
  const postRange = postRanges[load];
  if (postRange) {
    result.post = {
      minutesAfter: 60, // Within ~60 min per spec
      cho_g: Math.round(weightKg * postRange.cho),
      protein_g: Math.round(weightKg * postRange.protein)
    };
  }

  return result;
}

/**
 * Main function: Calculate daily targets based on profile and training load
 */
export function calculateDayTarget(profile: UserProfile, load: TrainingLoad, dateISO: string): DayTarget {
  // Step 1 & 2: Calculate TDEE
  const bmr = calculateBMR(profile);
  const activityFactor = getActivityFactor(load);
  const tdee = Math.round(bmr * activityFactor / 10) * 10; // Round to nearest 10

  // Step 3: Calculate macros
  const { cho: choPerKg, protein: proteinPerKg } = getMacroTargetsPerKg(load);
  const choGrams = Math.round(profile.weightKg * choPerKg);
  const proteinGrams = Math.round(profile.weightKg * proteinPerKg);
  
  // Fat = minimum 20% of kcal
  const minFatKcal = tdee * 0.2;
  const fatGrams = Math.round(minFatKcal / 9);

  // Step 4: Split into meals
  const mealRatios = getMealRatios(load);
  const meals = Object.entries(mealRatios)
    .filter(([_, ratio]) => ratio > 0)
    .map(([meal, ratio]) => ({
      meal: meal as MealType,
      ratio,
      cho_g: Math.round(choGrams * ratio),
      protein_g: Math.round(proteinGrams * ratio),
      fat_g: Math.round(fatGrams * ratio),
      kcal: Math.round(tdee * ratio / 10) * 10
    }));

  // Step 5: Calculate fueling windows
  const fueling = calculateFuelingWindows(profile, load);

  return {
    date: dateISO,
    load,
    kcal: tdee,
    grams: {
      cho: choGrams,
      protein: proteinGrams,
      fat: fatGrams
    },
    fueling,
    meals
  };
}

/**
 * Recovery nutrition needs based on unified engine calculations
 */
export interface RecoveryNeeds {
  quickRecovery: {
    timing: string;
    carbsG: number;
    proteinG: number;
    fatG: number;
    calories: number;
  };
  fullRecovery: {
    timing: string;
    carbsG: number;
    proteinG: number;
    fatG: number;
    calories: number;
  };
}

export interface RecoveryMeal {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timing: string;
  benefits: string[];
}

/**
 * Calculate post-workout recovery nutrition needs using the unified engine's
 * macro calculations and timing windows
 */
export function calculateRecoveryNeeds(
  profile: UserProfile,
  workout: {
    intensity: string;
    duration: number;
    distance?: number;
    calories_burned: number;
  }
): RecoveryNeeds {
  const { weightKg } = profile;
  const { intensity, duration, distance } = workout;

  // Map workout to training load
  const load: TrainingLoad = 
    intensity === 'high' || duration > 90 ? 'quality' :
    duration > 75 ? 'long' :
    duration > 45 ? 'moderate' :
    'easy';

  // Use unified engine's post-workout fueling calculations
  const fueling = calculateFuelingWindows(profile, load);
  
  if (!fueling.post) {
    // Fallback for very light sessions
    return {
      quickRecovery: {
        timing: '30 minutes',
        carbsG: Math.round(weightKg * 0.5),
        proteinG: Math.round(weightKg * 0.2),
        fatG: Math.round(weightKg * 0.1),
        calories: Math.round((weightKg * 0.5 * 4) + (weightKg * 0.2 * 4) + (weightKg * 0.1 * 9))
      },
      fullRecovery: {
        timing: '2 hours',
        carbsG: Math.round(weightKg * 1.0),
        proteinG: Math.round(weightKg * 0.3),
        fatG: Math.round(weightKg * 0.2),
        calories: Math.round((weightKg * 1.0 * 4) + (weightKg * 0.3 * 4) + (weightKg * 0.2 * 9))
      }
    };
  }

  // Use post-workout window from unified calculations
  return {
    quickRecovery: {
      timing: '30 minutes',
      carbsG: fueling.post.cho_g,
      proteinG: fueling.post.protein_g,
      fatG: Math.round(fueling.post.protein_g * 0.3), // 30% of protein for essential fats
      calories: Math.round(
        (fueling.post.cho_g * 4) +
        (fueling.post.protein_g * 4) +
        (Math.round(fueling.post.protein_g * 0.3) * 9)
      )
    },
    fullRecovery: {
      timing: '2 hours',
      carbsG: Math.round(fueling.post.cho_g * 1.5),
      proteinG: Math.round(fueling.post.protein_g * 1.3),
      fatG: Math.round(fueling.post.protein_g * 0.4),
      calories: Math.round(
        (fueling.post.cho_g * 1.5 * 4) +
        (fueling.post.protein_g * 1.3 * 4) +
        (Math.round(fueling.post.protein_g * 0.4) * 9)
      )
    }
  };
}

/**
 * Get Indonesian recovery meal suggestions based on calculated needs
 */
export function getIndonesianRecoveryMeals(needs: RecoveryNeeds): {
  quick: RecoveryMeal;
  full: RecoveryMeal;
} {
  const { quickRecovery, fullRecovery } = needs;

  return {
    quick: {
      name: 'Susu Pisang + Roti Selai Kacang',
      description: 'Kombinasi cepat dengan rasio karbohidrat-protein optimal',
      calories: quickRecovery.calories,
      protein: quickRecovery.proteinG,
      carbs: quickRecovery.carbsG,
      fat: quickRecovery.fatG,
      timing: quickRecovery.timing,
      benefits: [
        'Rasio karbohidrat-protein 4:1 untuk pemulihan glikogen',
        'Protein cepat serap untuk pemulihan otot',
        'Elektrolit dari susu membantu rehidrasi',
        'Kalium dari pisang mencegah kram'
      ]
    },
    full: {
      name: 'Bubur Ayam Komplit',
      description: 'Makanan pemulihan lengkap dengan karbohidrat kompleks dan protein',
      calories: fullRecovery.calories,
      protein: fullRecovery.proteinG,
      carbs: fullRecovery.carbsG,
      fat: fullRecovery.fatG,
      timing: fullRecovery.timing,
      benefits: [
        'Karbohidrat kompleks memulihkan simpanan glikogen',
        'Profil protein lengkap untuk perbaikan otot',
        'Kaya zat besi untuk transportasi oksigen',
        'Elektrolit seimbang untuk rehidrasi'
      ]
    }
  };
}