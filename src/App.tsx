import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { UploadProvider } from "@/contexts/UploadContext";
import { ErrorBoundary } from "react-error-boundary";
import Index from "./pages/Index";
import ProfileNew from "./pages/ProfileNew";
import { Dashboard2 } from "./components/Dashboard2";
import { Dashboard3 } from "./components/Dashboard3";
import ProfileInformation from "./pages/ProfileInformation";
import FoodPreferences from "./pages/FoodPreferences";
import NotificationsSettings from "./pages/NotificationsSettings";
import AppIntegrations from "./pages/AppIntegrations";
import Goals from "./pages/Goals";
import Training from "./pages/Training.tsx";
import TrainingCalendar from "./pages/TrainingCalendar";
import Community from "./pages/Community";
import Auth from "./pages/Auth";
import Import from "./pages/Import";
import Meals from "./pages/Meals";
import MealPlans from "./pages/MealPlans";
import ShoppingList from "./pages/ShoppingList";
import MealHistory from "./pages/MealHistory";
import SupabaseDebug from "./pages/SupabaseDebug";
import GoogleFitDebug from "./pages/GoogleFitDebug";
import ForceSyncDebug from "./pages/ForceSyncDebug";
import MarathonCalendarPage from "./pages/MarathonCalendarPage";
import Offline from "./pages/Offline";
import NotFound from "./pages/NotFound";
import { GlobalUploadIndicator } from "@/components/GlobalUploadIndicator";
import { PWAUpdateNotification } from "@/components/PWAUpdateNotification";
import OnboardingWizard from "./pages/OnboardingWizard";

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

function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('App Error:', error, errorInfo);
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UploadProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <GlobalUploadIndicator />
              <PWAUpdateNotification />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/dashboard2" element={<Dashboard2 />} />
                  <Route path="/dashboard3" element={<Dashboard3 />} />
                  <Route path="/profile" element={<ProfileNew />} />
                  <Route path="/profile/information" element={<ProfileInformation />} />
                  <Route path="/profile/food-preferences" element={<FoodPreferences />} />
                  <Route path="/profile/notifications" element={<NotificationsSettings />} />
                  <Route path="/profile/integrations" element={<AppIntegrations />} />
                  <Route path="/goals" element={<Goals />} />
                  <Route path="/training" element={<Training />} />
                  <Route path="/training-calendar" element={<TrainingCalendar />} />
                  <Route path="/marathons" element={<MarathonCalendarPage />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/import" element={<Import />} />
                  <Route path="/meals" element={<Meals />} />
                  <Route path="/meal-plans" element={<MealPlans />} />
                  <Route path="/shopping-list" element={<ShoppingList />} />
                  <Route path="/meal-history" element={<MealHistory />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/debug/supabase" element={<SupabaseDebug />} />
                  <Route path="/debug/google-fit" element={<GoogleFitDebug />} />
            <Route path="/debug/force-sync" element={<ForceSyncDebug />} />
                  <Route path="/offline" element={<Offline />} />
                  <Route path="/onboarding" element={<OnboardingWizard />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </UploadProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
