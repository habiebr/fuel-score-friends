import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { UploadProvider } from "@/contexts/UploadContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense, lazy } from "react";

// Initialize i18n
import "@/lib/i18n";

// Preload critical pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";

// Lazy load non-critical pages - these improve initial load time
const ProfileNew = lazy(() => import("./pages/ProfileNew"));
const ProfileInformation = lazy(() => import("./pages/ProfileInformation"));
const FoodPreferences = lazy(() => import("./pages/FoodPreferences"));
const NotificationsSettings = lazy(() => import("./pages/NotificationsSettings"));
const AppIntegrations = lazy(() => import("./pages/AppIntegrations"));
const Goals = lazy(() => import("./pages/Goals"));
const RaceGoal = lazy(() => import("./pages/RaceGoal"));
const TrainingPlan = lazy(() => import("./pages/TrainingPlan"));
const Training = lazy(() => import("./pages/Training"));
const TrainingCalendar = lazy(() => import("./pages/TrainingCalendar"));
const Community = lazy(() => import("./pages/Community"));
const ScoreExplainerPage = lazy(() => import("./pages/ScoreExplainer"));
const NutritionExplainerPage = lazy(() => import("./pages/NutritionExplainer"));
const CachedWidgetsDemo = lazy(() => import("./pages/CachedWidgetsDemo"));
const Import = lazy(() => import("./pages/Import"));
const Meals = lazy(() => import("./pages/Meals"));
const MealPlans = lazy(() => import("./pages/MealPlans"));
const ShoppingList = lazy(() => import("./pages/ShoppingList"));
const MealHistory = lazy(() => import("./pages/MealHistory"));
const MarathonCalendarPage = lazy(() => import("./pages/MarathonCalendarPage"));
const Offline = lazy(() => import("./pages/Offline"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OnboardingWizard = lazy(() => import("./pages/OnboardingWizard"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const AboutNutriSync = lazy(() => import("./pages/AboutNutriSync"));
const FoodShareDemo = lazy(() => import("./pages/FoodShareDemo"));

import { GlobalUploadIndicator } from "@/components/GlobalUploadIndicator";
import { PWAUpdateNotification } from "@/components/PWAUpdateNotification";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
          <p className="text-slate-300">
            The app encountered an error. This might be due to missing configuration.
          </p>
          <details className="text-left text-sm text-slate-400">
            <summary className="cursor-pointer">Error details</summary>
            <pre className="mt-2 p-2 bg-slate-800 rounded text-xs overflow-auto">
              {error.message}
            </pre>
          </details>
        </div>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

// Loading fallback for lazy-loaded routes
function RouteLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center">
      <div className="animate-pulse">
        <div className="w-12 h-12 bg-primary rounded-full animate-pulse-glow"></div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('App Error:', error, errorInfo);
      }}
    >
      <QueryClientProvider client={queryClient}>
               <LanguageProvider>
                 <AuthProvider>
                   <UploadProvider>
                     <TooltipProvider>
                       <Toaster />
                       <Sonner />
                       <GlobalUploadIndicator />
                       <PWAUpdateNotification />
                       <BrowserRouter>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/offline" element={<Offline />} />
                  
                  {/* Protected Routes - Index (critical, preloaded) */}
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />

                  {/* Protected Routes - Lazy loaded */}
                  <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><ProfileNew /></Suspense></ProtectedRoute>} />
                  <Route path="/profile-info" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><ProfileInformation /></Suspense></ProtectedRoute>} />
                  <Route path="/food-preferences" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><FoodPreferences /></Suspense></ProtectedRoute>} />
                  <Route path="/notifications-settings" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><NotificationsSettings /></Suspense></ProtectedRoute>} />
                  <Route path="/integrations" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><AppIntegrations /></Suspense></ProtectedRoute>} />
                  <Route path="/goals" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><Goals /></Suspense></ProtectedRoute>} />
                  <Route path="/race-goal" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><RaceGoal /></Suspense></ProtectedRoute>} />
                  <Route path="/training-plan" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><TrainingPlan /></Suspense></ProtectedRoute>} />
                  <Route path="/training" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><Training /></Suspense></ProtectedRoute>} />
                  <Route path="/training-calendar" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><TrainingCalendar /></Suspense></ProtectedRoute>} />
                  <Route path="/community" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><Community /></Suspense></ProtectedRoute>} />
                  <Route path="/score-explainer" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><ScoreExplainerPage /></Suspense></ProtectedRoute>} />
                  <Route path="/nutrition-explainer" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><NutritionExplainerPage /></Suspense></ProtectedRoute>} />
                  <Route path="/cached-widgets-demo" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><CachedWidgetsDemo /></Suspense></ProtectedRoute>} />
                  <Route path="/import" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><Import /></Suspense></ProtectedRoute>} />
                  <Route path="/meals" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><Meals /></Suspense></ProtectedRoute>} />
                  <Route path="/meal-plans" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><MealPlans /></Suspense></ProtectedRoute>} />
                  <Route path="/shopping-list" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><ShoppingList /></Suspense></ProtectedRoute>} />
                  <Route path="/meal-history" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><MealHistory /></Suspense></ProtectedRoute>} />
                  <Route path="/marathon-calendar" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><MarathonCalendarPage /></Suspense></ProtectedRoute>} />
                  <Route path="/onboarding" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><OnboardingWizard /></Suspense></ProtectedRoute>} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/about" element={<Suspense fallback={<RouteLoadingFallback />}><AboutNutriSync /></Suspense>} />
                  <Route path="/food-share-demo" element={<ProtectedRoute><Suspense fallback={<RouteLoadingFallback />}><FoodShareDemo /></Suspense></ProtectedRoute>} />

                  {/* 404 - Lazy load */}
                  <Route path="*" element={<Suspense fallback={<RouteLoadingFallback />}><NotFound /></Suspense>} />
                </Routes>
                       </BrowserRouter>
                     </TooltipProvider>
                   </UploadProvider>
                 </AuthProvider>
               </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
