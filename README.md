# 🏃‍♂️ Fuel Score Friends - Marathon Nutrition PWA

A Progressive Web App that helps runners prepare nutritionally for race day with science-based nutrition tracking, intelligent meal planning, and automated workout-to-fueling recommendations.

## 🎯 Overview

Fuel Score Friends is a comprehensive nutrition and training tracking system designed specifically for marathon runners. It combines:
- **Science-based nutrition calculations** using proven formulas (Mifflin-St Jeor BMR, runner-specific macros)
- **Training load classification** to dynamically adjust daily nutrition targets
- **Google Fit integration** for automatic workout detection and recovery nutrition
- **Offline-first PWA** that works without internet connection
- **Mobile-optimized UI** with touch-friendly interactions

## ✨ Key Features

### 🧮 Science-Based Nutrition Engine
- **BMR Calculation**: Mifflin-St Jeor formula for accurate basal metabolic rate
- **TDEE Adaptation**: Dynamic total daily energy expenditure based on training load
- **Runner-Specific Macros**: 
  - Carbohydrates: 5-7 g/kg for endurance training
  - Protein: 1.2-1.6 g/kg for muscle recovery
  - Fat: Minimum 20% of total calories
- **Fueling Windows**: Pre-run, during, and post-run nutrition recommendations
- **Meal Planning**: AI-powered meal suggestions based on training intensity

### 🏃 Training Integration
- **Training Load Classification**: Rest, Easy, Moderate, Quality, Long
- **Actual vs Planned Tracking**: Compare planned workouts with actual activity
- **Google Fit Sync**: Automatic workout detection and logging
- **Recovery Nutrition**: Post-workout meal suggestions with countdown timer
- **Training Calendar**: Timezone-aware calendar with planned and actual sessions

### 📊 Smart Scoring System
- **Daily Nutrition Score**: 0-100 based on macro compliance
- **Training Nutrition Score**: Evaluates fueling timing and recovery meals
- **Unified Score**: Combines nutrition, training, bonuses, and penalties
- **Weekly Analytics**: Trends and insights for continuous improvement

### 📱 Progressive Web App Features
- **Installable**: Add to home screen on mobile devices
- **Offline Support**: Service worker caches daily data for offline access
- **Mobile-First Design**: Touch-optimized with 44×44px minimum targets
- **Dark Mode**: Full dark/light theme support
- **Accessibility**: WCAG AA compliant with proper ARIA labels

## 🛠️ Tech Stack

### Frontend
- **Vite** - Fast build tool and dev server
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library
- **Radix UI** - Unstyled, accessible components
- **date-fns** - Date manipulation
- **Recharts** - Data visualization

### Backend
- **Supabase** - PostgreSQL database
- **Supabase Edge Functions** - Serverless backend logic
- **Cloudflare Pages** - Hosting and CDN
- **Workbox** - Service worker and caching

### Integrations
- **Google Fit API** - Workout tracking
- **Strava API** - Additional activity data
- **Runna Integration** - Training plan sync

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Google Cloud Console (for Fit integration)

### Installation

```bash
# Clone the repository
git clone https://github.com/habiebr/nutrisync.git

# Navigate to project directory
cd nutrisync

# Install dependencies
npm install

# Create environment file
cp cloudflare.env.example .env

# Edit .env with your Supabase credentials
# Get credentials from: https://supabase.com/dashboard/project/_/settings/api
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure

```
nutrisync/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/             # Route components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Business logic & science layer
│   ├── science/           # Pure nutrition calculations
│   ├── services/          # API integration layer
│   └── integrations/      # Third-party integrations
├── supabase/
│   ├── functions/         # Edge Functions (serverless)
│   └── migrations/       # Database migrations
├── docs/                  # Implementation guides
├── docs/test-verify/      # Test results & verification
├── cleanup/               # Old scripts (archived)
└── tests/                 # Vitest test suite
```

## 🔬 Science Layer

The app uses proven nutritional science formulas:

### Basal Metabolic Rate (BMR)
```
BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + sexOffset
```

### Training Load → TDEE Multiplier
| Load | Factor | Calories |
|------|--------|----------|
| Rest | 1.2 | Maintenance |
| Easy | 1.4 | Light training |
| Moderate | 1.6 | Regular training |
| Quality | 1.8 | High-intensity |
| Long | 2.0 | Extended workouts |

### Runner-Specific Macros
Based on international sports nutrition guidelines:
- **Carbs**: 5-7 g/kg for endurance training
- **Protein**: 1.2-1.6 g/kg for muscle recovery
- **Fat**: Minimum 20% of total daily calories

See [docs/MARATHON_NUTRITION_MVP.md](docs/MARATHON_NUTRITION_MVP.md) for complete calculations.

## 📝 Key Functions

### Nutrition Calculations
```typescript
import { targetsMVP, calculateTDEE, calculateMacros } from '@/lib/marathon-nutrition';

// Calculate complete daily nutrition targets
const targets = targetsMVP(profile, trainingLoad, date);

// Get specific calculations
const tdee = calculateTDEE(profile, trainingLoad);
const macros = calculateMacros(profile, trainingLoad, tdee);
```

### Scoring System
```typescript
import { dailyScore } from '@/science/dailyScore';

const score = dailyScore({
  planned: { calories: 2500, protein: 120, carbs: 350, fat: 70 },
  consumed: { calories: 2300, protein: 110, carbs: 320, fat: 65 },
  activityCalories: 400
});
```

## 🗄️ Database Schema

Key tables:
- `profiles` - User profile (weight, height, age, sex, timezone)
- `training_activities` - Planned and actual workouts
- `food_logs` - Food consumption entries
- `daily_meal_plans` - Nutrition targets per meal type
- `nutrition_scores` - Calculated daily scores
- `google_fit_sessions` - Individual workout sessions
- `google_fit_data` - Daily aggregate activity data

See [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts) for complete schema.

## 🚢 Deployment

### Beta Deployment
```bash
npm run deploy
```

Deploys to:
- **URL**: https://beta.nutrisync.id
- **Project**: nutrisync-beta (Cloudflare Pages)
- **Branch**: beta

### Production Deployment
```bash
npm run deploy:prod
```

Deploys to:
- **URL**: https://nutrisync.id
- **Project**: nutrisync (Cloudflare Pages)
- **Branch**: main

## 📚 Documentation

- [Implementation Guides](docs/) - Complete implementation documentation
- [Test Results](docs/test-verify/) - Test reports and verification
- [Science Layer](docs/MARATHON_NUTRITION_MVP.md) - Nutrition calculation formulas
- [Google Fit Integration](docs/GOOGLE_FIT_INTEGRATION.md) - API integration guide

## 🤝 Development Guidelines

### Code Organization
- **Science Layer** (`src/lib/`, `src/science/`) - Pure calculation functions
- **Services** (`src/services/`) - API wrappers and business logic
- **Components** (`src/components/`) - Reusable UI components
- **Pages** (`src/pages/`) - Route components

### Best Practices
- ✅ Always import existing functions from science layer
- ✅ Test pure functions with Vitest
- ✅ Mobile-first responsive design
- ✅ Accessibility: use semantic HTML, ARIA labels
- ✅ Timezone-aware date handling
- ❌ Never hardcode nutrition formulas
- ❌ Don't create hover-only interactions
- ❌ Don't duplicate data between tables

### Testing
```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Coverage report
npm run test:coverage
```

## 🔐 Environment Variables

Required environment variables (see `cloudflare.env.example`):

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Fit
VITE_GOOGLE_CLIENT_ID=your-client-id
GOOGLE_FIT_CLIENT_ID=your-client-id
GOOGLE_FIT_CLIENT_SECRET=your-client-secret
GOOGLE_TOKEN_REFRESH_SECRET=your-cron-secret

# App Configuration
VITE_APP_NAME=Fuel Score Friends
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production
```

## 🐛 Troubleshooting

### Build Issues
```bash
# Clear cache and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Database Migrations
```bash
# Apply pending migrations
supabase db push

# Check migration status
supabase migration list
```

### Google Fit Sync Issues
- Check token expiry in Supabase dashboard
- Verify OAuth credentials in Google Cloud Console
- Review sync logs in Supabase Edge Functions logs

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Based on international sports nutrition guidelines
- Uses proven formulas from exercise science research
- Built with modern PWA technologies for optimal performance

---

**Built with ❤️ for runners preparing for their marathon race day** 🏃‍♂️💨
