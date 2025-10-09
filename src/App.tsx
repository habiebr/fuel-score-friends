import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { UploadProvider } from "@/contexts/UploadContext";
// Old meal suggestions removed
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "react-error-boundary";
import Index from "./pages/Index";
import ProfileNew from "./pages/ProfileNew";
import { Dashboard2 } from "./components/Dashboard2";
import ProfileInformation from "./pages/ProfileInformation";
import FoodPreferences from "./pages/FoodPreferences";
import { MealPreferencesForm } from "./components/MealPreferencesForm";
import { PageHeading } from "./components/PageHeading";
import NotificationsSettings from "./pages/NotificationsSettings";
import AppIntegrations from "./pages/AppIntegrations";
import Goals from "./pages/Goals";
import Training from "./pages/Training.tsx";
import TrainingCalendar from "./pages/TrainingCalendar";
import Community from "./pages/Community";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import { CachedWidgetsDemo } from "./pages/CachedWidgetsDemo";
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
                  {/* Public Routes */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/offline" element={<Offline />} />

                  {/* Protected Routes */}
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  } />
                  <Route path="/dashboard2" element={
                    <ProtectedRoute>
                      <Dashboard2 />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <ProfileNew />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile/information" element={
                    <ProtectedRoute>
                      <ProfileInformation />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile/food-preferences" element={
                    <ProtectedRoute>
                      <FoodPreferences />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile/meal-preferences" element={
                    <ProtectedRoute>
                      <div className="min-h-screen bg-gradient-background pb-20">
                        <div className="max-w-none mx-auto p-4">
                          <PageHeading
                            title="Meal Preferences"
                            description="Configure your meal planning mode and preferences."
                            className="pt-2"
                          />
                          <MealPreferencesForm />
                        </div>
                      </div>
                    </ProtectedRoute>
                  } />
                  <Route path="/profile/notifications" element={
                    <ProtectedRoute>
                      <NotificationsSettings />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile/integrations" element={
                    <ProtectedRoute>
                      <AppIntegrations />
                    </ProtectedRoute>
                  } />
                  <Route path="/goals" element={
                    <ProtectedRoute>
                      <Goals />
                    </ProtectedRoute>
                  } />
                  <Route path="/training" element={
                    <ProtectedRoute>
                      <Training />
                    </ProtectedRoute>
                  } />
                  <Route path="/training-calendar" element={
                    <ProtectedRoute>
                      <TrainingCalendar />
                    </ProtectedRoute>
                  } />
                  <Route path="/marathons" element={
                    <ProtectedRoute>
                      <MarathonCalendarPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/community" element={
                    <ProtectedRoute>
                      <Community />
                    </ProtectedRoute>
                  } />
                           <Route path="/import" element={
                             <ProtectedRoute>
                               <Import />
                             </ProtectedRoute>
                           } />
                           <Route path="/cached-widgets-demo" element={
                             <ProtectedRoute>
                               <CachedWidgetsDemo />
                             </ProtectedRoute>
                           } />
                           <Route path="/meals" element={
                    <ProtectedRoute>
                      <Meals />
                    </ProtectedRoute>
                  } />
                  <Route path="/meal-plans" element={
                    <ProtectedRoute>
                      <MealPlans />
                    </ProtectedRoute>
                  } />
                  <Route path="/shopping-list" element={
                    <ProtectedRoute>
                      <ShoppingList />
                    </ProtectedRoute>
                  } />
                  <Route path="/meal-history" element={
                    <ProtectedRoute>
                      <MealHistory />
                    </ProtectedRoute>
                  } />

                  {/* Admin/Debug Routes - Require admin role */}
                  <Route path="/debug/supabase" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <SupabaseDebug />
                    </ProtectedRoute>
                  } />
                  <Route path="/debug/google-fit" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <GoogleFitDebug />
                    </ProtectedRoute>
                  } />
                  <Route path="/debug/force-sync" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ForceSyncDebug />
                    </ProtectedRoute>
                  } />

                  {/* Onboarding Route - Protected but accessible to all users */}
                  <Route path="/onboarding" element={
                    <ProtectedRoute>
                      <OnboardingWizard />
                    </ProtectedRoute>
                  } />

                  {/* Catch-all route */}
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
