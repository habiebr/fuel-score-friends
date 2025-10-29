# Training Calendar Widget Translation Assessment

## Current Status

**i18n Infrastructure:** ✅ Already exists
- `i18next` and `react-i18next` installed
- Translation files: `en.json` and `id.json`
- `LanguageContext` and `LanguageSwitcher` components available
- Currently set to force English as default

## Hardcoded Text Found in TrainingNutritionWidget

### 1. **Training Status Labels** (Lines 527-531)
```typescript
'Actual Training'
'Planned Training'
'✓ Completed'
```

### 2. **Intensity Labels** (Lines 551, 563, 579)
```typescript
'moderate intensity'
'high intensity'
'low intensity'
```

### 3. **Unit Labels** (Lines 496-510)
```typescript
'km'
'min'
'kcal'
```

### 4. **Recommendation Text** (Lines 301-448)
```typescript
'All day'
'Every 45-60 minutes'
'Within {minutesAfter} minutes'
'hours before'
'hours before tomorrow\'s training'

// Food suggestions
'Banana with peanut butter'
'Oatmeal with berries'
'Toast with honey'
'Greek yogurt with granola'
'Sports drink'
'Energy gels'
'Banana'
'Dates'
'Chocolate milk'
'Protein smoothie'
'Rice with chicken'
'Greek yogurt with fruit'

// Benefits text
'Focus on whole foods'
'Stay hydrated'
'Get adequate sleep'
'Light stretching or yoga'
'Sustained energy'
'Prevents hunger'
'Optimizes performance'
'Maintains energy'
'Prevents bonking'
'Sustains performance'
'Muscle recovery'
'Glycogen replenishment'
'Reduces soreness'
```

### 5. **Training Load Labels** (Passed as data)
- 'rest', 'easy', 'moderate', 'long', 'quality'

## Effort Required

### Low Effort (~30 minutes)

1. **Add translation keys to `en.json` and `id.json`**
2. **Update component to use `useTranslation` hook**
3. **Replace hardcoded strings with `t()` calls**

### Translation Keys Needed

```json
{
  "trainingWidget": {
    "actualTraining": "Actual Training",
    "plannedTraining": "Planned Training",
    "completed": "Completed",
    "restDayRecovery": "Rest Day Recovery",
    "allDay": "All day",
    "every4560Min": "Every 45-60 minutes",
    "withinMinutes": "Within {{minutes}} minutes",
    "hoursBefore": "{{hours}} hours before",
    "hoursBeforeTomorrow": "{{hours}} hours before tomorrow's training",
    "trainingLoad": {
      "rest": "Rest",
      "easy": "Easy",
      "moderate": "Moderate",
      "long": "Long",
      "quality": "Quality"
    },
    "intensity": {
      "low": "Low",
      "moderate": "Moderate",
      "high": "High"
    },
    "suggestions": {
      "preWorkout": [
        "Banana with peanut butter",
        "Oatmeal with berries",
        "Toast with honey",
        "Greek yogurt with granola"
      ],
      "duringWorkout": [
        "Sports drink",
        "Energy gels",
        "Banana",
        "Dates"
      ],
      "postWorkout": [
        "Chocolate milk",
        "Protein smoothie",
        "Rice with chicken",
        "Greek yogurt with fruit"
      ],
      "restDay": [
        "Focus on whole foods",
        "Stay hydrated",
        "Get adequate sleep",
        "Light stretching or yoga"
      ]
    },
    "benefits": {
      "sustainedEnergy": "Sustained energy",
      "preventsHunger": "Prevents hunger",
      "optimizesPerformance": "Optimizes performance",
      "maintainsEnergy": "Maintains energy",
      "preventsBonking": "Prevents bonking",
      "sustainsPerformance": "Sustains performance",
      "muscleRecovery": "Muscle recovery",
      "glycogenReplenishment": "Glycogen replenishment",
      "reducesSoreness": "Reduces soreness",
      "muscleRecoveryRest": "Muscle recovery",
      "energyRestoration": "Energy restoration",
      "mentalRelaxation": "Mental relaxation"
    }
  }
}
```

## Implementation Steps

### Step 1: Import translation hook
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Use in component
```typescript
export function TrainingNutritionWidget({ selectedDate, activities, tomorrowActivities = [], onRefresh }: TrainingNutritionWidgetProps) {
  const { t } = useTranslation();
  
  // Replace hardcoded strings
  const actualTrainingLabel = hasActual || todayAggregate 
    ? t('trainingWidget.actualTraining') 
    : t('trainingWidget.plannedTraining');
    
  // etc.
}
```

### Step 3: Update activity type capitalization
```typescript
// Instead of:
<p className="font-medium capitalize">{s.activity_type || 'run'}</p>

// Use:
<p className="font-medium capitalize">
  {t(`trainingWidget.trainingLoad.${s.activity_type || 'run'}`)}
</p>
```

## Indonesian Translations Needed

```json
{
  "trainingWidget": {
    "actualTraining": "Latihan Aktual",
    "plannedTraining": "Latihan Terencana",
    "completed": "Selesai",
    "restDayRecovery": "Pemulihan Hari Istirahat",
    "allDay": "Sepanjang hari",
    "every4560Min": "Setiap 45-60 menit",
    "withinMinutes": "Dalam {{minutes}} menit",
    "hoursBefore": "{{hours}} jam sebelumnya",
    "hoursBeforeTomorrow": "{{hours}} jam sebelum latihan besok",
    "trainingLoad": {
      "rest": "Istirahat",
      "easy": "Ringan",
      "moderate": "Sedang",
      "long": "Panjang",
      "quality": "Kualitas"
    },
    "intensity": {
      "low": "Rendah",
      "moderate": "Sedang",
      "high": "Tinggi"
    },
    "suggestions": {
      "preWorkout": [
        "Pisang dengan selai kacang",
        "Oatmeal dengan beri",
        "Roti dengan madu",
        "Yogurt Yunani dengan granola"
      ],
      "duringWorkout": [
        "Minuman olahraga",
        "Gel energi",
        "Pisang",
        "Kurma"
      ],
      "postWorkout": [
        "Susu coklat",
        "Smoothie protein",
        "Nasi dengan ayam",
        "Yogurt Yunani dengan buah"
      ],
      "restDay": [
        "Fokus pada makanan utuh",
        "Tetap terhidrasi",
        "Dapatkan tidur yang cukup",
        "Peregangan ringan atau yoga"
      ]
    },
    "benefits": {
      "sustainedEnergy": "Energi berkelanjutan",
      "preventsHunger": "Mencegah kelaparan",
      "optimizesPerformance": "Mengoptimalkan performa",
      "maintainsEnergy": "Mempertahankan energi",
      "preventsBonking": "Mencegah bonking",
      "sustainsPerformance": "Menopang performa",
      "muscleRecovery": "Pemulihan otot",
      "glycogenReplenishment": "Isi ulang glikogen",
      "reducesSoreness": "Mengurangi nyeri",
      "muscleRecoveryRest": "Pemulihan otot",
      "energyRestoration": "Pemulihan energi",
      "mentalRelaxation": "Relaksasi mental"
    }
  }
}
```

## Benefits

✅ **Consistency**: Matches existing i18n infrastructure  
✅ **User Experience**: Indonesian users see native language  
✅ **Easy to Extend**: Add more languages easily  
✅ **Low Risk**: Existing i18n already working in other parts of app  

## Alternative: Keep English Only

If translation is not a priority:
- **Pros**: Less maintenance, universal language
- **Cons**: Indonesian users see English, less user-friendly

## Recommendation

**Implement translations** - The infrastructure already exists, the effort is minimal (~30 mins), and it improves UX for Indonesian users.

### Estimated Time
- Adding translation keys: 15 minutes
- Updating component: 15 minutes
- Testing: 10 minutes
- **Total: ~40 minutes**

